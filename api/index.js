import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'

const localDbPath = path.join(process.cwd(), '.data', 'local-db.json')

let cached = global.mongooseConnection
if (!cached) cached = global.mongooseConnection = { conn: null, promise: null }

async function connectDb() {
  if (cached.conn) return cached.conn
  if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI')
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB || undefined,
    })
  }
  cached.conn = await cached.promise
  return cached.conn
}

const MonthConfigSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // YYYY-MM
  salary: { type: Number, default: 0 },
  foodPercent: { type: Number, default: 30 },
  notes: { type: String, default: '' },
}, { timestamps: true })

const ExpenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  month: { type: String, required: true }, // YYYY-MM
  category: { type: String, default: 'general' },
  type: { type: String, enum: ['variable', 'fixed', 'debt', 'income-adjustment'], default: 'variable' },
  paymentMethod: { type: String, default: 'efectivo' },
  creditCard: { type: String, enum: ['', 'visa', 'mastercard'], default: '' },
  installments: { type: Number, default: 1 },
  installmentNumber: { type: Number, default: 1 },
  installmentGroupId: { type: String, default: '' },
  isPaid: { type: Boolean, default: false },
  isFixed: { type: Boolean, default: false },
  fixedDay: { type: Number, default: null },
  renewUntil: { type: String, default: '' }, // YYYY-MM optional
  notes: { type: String, default: '' },
}, { timestamps: true })

const LoanSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lender: { type: String, default: '' },
  startMonth: { type: String, required: true },
  principal: { type: Number, required: true },
  totalToReturn: { type: Number, required: true },
  installments: { type: Number, required: true },
  averageInstallment: { type: Number, required: true },
  currentInstallment: { type: Number, default: 1 },
  loanUnit: { type: String, enum: ['ars', 'uva'], default: 'ars' },
  uvaValue: { type: Number, default: 0 },
  paymentDay: { type: Number, default: 10 },
  category: { type: String, default: 'prestamo' },
  notes: { type: String, default: '' },
  payments: [{
    month: String,
    amount: Number,
    isPaid: Boolean,
    paidAt: String,
    notes: String,
  }],
}, { timestamps: true })

const MonthConfig = mongoose.models.MonthConfig || mongoose.model('MonthConfig', MonthConfigSchema)
const Expense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema)
const Loan = mongoose.models.Loan || mongoose.model('Loan', LoanSchema)

async function readLocalDb() {
  try {
    const raw = await fs.readFile(localDbPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { monthConfigs: [], expenses: [], loans: [] }
  }
}

async function writeLocalDb(db) {
  await fs.mkdir(path.dirname(localDbPath), { recursive: true })
  await fs.writeFile(localDbPath, JSON.stringify(db, null, 2))
}

function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function getMonth(date = new Date()) {
  if (typeof date === 'string') return date.slice(0, 7)
  return date.toISOString().slice(0, 7)
}

function addMonths(month, count) {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(year, m - 1 + count, 1))
  return d.toISOString().slice(0, 7)
}

function monthIndex(month) {
  const [year, m] = month.split('-').map(Number)
  return year * 12 + m
}

function fixedExpenseKey(expense) {
  return [
    expense.title,
    Number(expense.amount || 0),
    expense.category || 'general',
    expense.paymentMethod || 'efectivo',
    expense.creditCard || '',
  ].join('|')
}

function buildExpenseInstallments(body) {
  const installments = body.paymentMethod === 'credito' ? Math.max(Number(body.installments || 1), 1) : 1
  const baseMonth = body.month || getMonth(body.date)
  const day = String(Number(body.date?.slice(8, 10)) || 1).padStart(2, '0')
  const installmentGroupId = installments > 1 ? body.installmentGroupId || randomUUID() : ''

  return Array.from({ length: installments }, (_, index) => {
    const installmentMonth = addMonths(baseMonth, index)
    const installmentNumber = index + 1
    return {
      ...body,
      title: installments > 1 ? `${body.title} (${installmentNumber}/${installments})` : body.title,
      date: `${installmentMonth}-${day}`,
      month: installmentMonth,
      amount: Number(body.amount || 0),
      installments,
      installmentNumber,
      installmentGroupId,
      fixedDay: body.fixedDay || Number(day) || null,
      isPaid: installmentNumber === 1 ? Boolean(body.isPaid) : false,
    }
  })
}

function getAverageInstallment(body) {
  return Number(body.averageInstallment || Math.round(Number(body.totalToReturn) / Number(body.installments)) || 0)
}

function getLoanUnit(loan) {
  return loan.loanUnit || 'ars'
}

function amountToPesos(loan, amount) {
  if (getLoanUnit(loan) !== 'uva') return Number(amount || 0)
  return Math.round(Number(amount || 0) * Number(loan.uvaValue || 0))
}

function normalizeLoanTimeline(body) {
  const installments = Number(body.installments || 1)
  const currentInstallment = Math.min(Math.max(Number(body.currentInstallment || 1), 1), installments)
  const currentMonth = body.currentMonth || getMonth()
  return {
    ...body,
    installments,
    currentInstallment,
    startMonth: currentInstallment > 1 ? addMonths(currentMonth, -(currentInstallment - 1)) : body.startMonth,
  }
}

function buildLoanPayments(body, existingPayments = []) {
  const loan = normalizeLoanTimeline(body)
  const averageInstallment = getAverageInstallment(body)
  const currentMonth = loan.currentMonth || getMonth()
  return Array.from({ length: Number(loan.installments) }, (_, i) => {
    const month = addMonths(loan.startMonth, i)
    const existing = existingPayments.find((payment) => payment.month === month)
    const isBeforeCurrent = monthIndex(month) < monthIndex(currentMonth)
    return {
      month,
      amount: averageInstallment,
      isPaid: existing ? Boolean(existing.isPaid) : isBeforeCurrent,
      paidAt: existing?.paidAt || (isBeforeCurrent ? new Date().toISOString() : ''),
      notes: existing?.notes || '',
    }
  })
}

async function ensureFixedExpensesForMonth(month) {
  const existing = await Expense.find({ month, isFixed: true }).lean()
  const existingKeys = new Set(existing.map(fixedExpenseKey))
  const sources = await Expense.find({
    isFixed: true,
    month: { $lt: month },
    $or: [{ renewUntil: '' }, { renewUntil: { $gte: month } }, { renewUntil: null }],
  }).sort({ month: 1, createdAt: 1 }).lean()

  const created = []
  for (const source of sources) {
    const key = fixedExpenseKey(source)
    if (existingKeys.has(key)) continue

    const day = String(source.fixedDay || Number(source.date?.slice(8, 10)) || 1).padStart(2, '0')
    created.push({
      title: source.title,
      amount: source.amount,
      date: `${month}-${day}`,
      month,
      category: source.category,
      type: 'fixed',
      paymentMethod: source.paymentMethod,
      creditCard: source.creditCard || '',
      isPaid: false,
      isFixed: true,
      fixedDay: source.fixedDay || Number(source.date?.slice(8, 10)) || null,
      renewUntil: source.renewUntil,
      notes: source.notes,
    })
    existingKeys.add(key)
  }

  if (created.length) await Expense.insertMany(created)
}

function ensureLocalFixedExpensesForMonth(db, month) {
  const existingKeys = new Set(db.expenses.filter((e) => e.month === month && e.isFixed).map(fixedExpenseKey))
  const sources = db.expenses
    .filter((e) => e.isFixed && e.month < month && (!e.renewUntil || e.renewUntil >= month))
    .sort((a, b) => `${a.month}-${a.createdAt || ''}`.localeCompare(`${b.month}-${b.createdAt || ''}`))

  for (const source of sources) {
    const key = fixedExpenseKey(source)
    if (existingKeys.has(key)) continue

    const day = String(source.fixedDay || Number(source.date?.slice(8, 10)) || 1).padStart(2, '0')
    db.expenses.push({
      _id: randomUUID(),
      title: source.title,
      amount: source.amount,
      date: `${month}-${day}`,
      month,
      category: source.category,
      type: 'fixed',
      paymentMethod: source.paymentMethod,
      creditCard: source.creditCard || '',
      isPaid: false,
      isFixed: true,
      fixedDay: source.fixedDay || Number(source.date?.slice(8, 10)) || null,
      renewUntil: source.renewUntil || '',
      notes: source.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    existingKeys.add(key)
  }
}

function loanForMonth(loan, month) {
  const start = monthIndex(loan.startMonth)
  const current = monthIndex(month)
  const installmentNumber = current - start + 1
  if (installmentNumber < 1 || installmentNumber > loan.installments) return null
  const payment = loan.payments?.find((p) => p.month === month)
  const paidCount = loan.payments?.filter((p) => p.isPaid).length || 0
  const paidAmount = loan.payments?.filter((p) => p.isPaid).reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
  const amountThisMonth = payment?.amount ?? loan.averageInstallment
  const loanUnit = getLoanUnit(loan)
  const paidInstallments = Math.min(
    loan.installments,
    Math.max(paidCount, installmentNumber - (payment?.isPaid ? 0 : 1))
  )
  const remainingInstallments = Math.max(Number(loan.installments || 0) - paidInstallments, 0)
  return {
    _id: loan._id,
    title: loan.title,
    lender: loan.lender,
    principal: loan.principal,
    totalToReturn: loan.totalToReturn,
    installments: loan.installments,
    averageInstallment: loan.averageInstallment,
    currentInstallment: installmentNumber,
    loanUnit,
    uvaValue: loan.uvaValue || 0,
    installmentNumber,
    amountThisMonth,
    amountThisMonthPesos: amountToPesos(loan, amountThisMonth),
    isPaid: Boolean(payment?.isPaid),
    paidCount,
    paidInstallments,
    remainingInstallments,
    paidAmount,
    paidAmountPesos: amountToPesos(loan, paidAmount),
    remainingAmount: Math.max(loan.totalToReturn - paidAmount, 0),
    remainingAmountPesos: amountToPesos(loan, Math.max(loan.totalToReturn - paidAmount, 0)),
    paymentDay: loan.paymentDay,
    startMonth: loan.startMonth,
    category: loan.category,
    payments: loan.payments || [],
    notes: loan.notes,
  }
}

async function getDashboard(month) {
  await ensureFixedExpensesForMonth(month)
  const [config, expenses, allLoans] = await Promise.all([
    MonthConfig.findOne({ month }).lean(),
    Expense.find({ month }).sort({ date: -1 }).lean(),
    Loan.find({}).sort({ startMonth: -1 }).lean(),
  ])
  const loans = allLoans.map((loan) => loanForMonth(loan, month)).filter(Boolean)
  const salary = config?.salary || 0
  const foodPercent = config?.foodPercent ?? 30
  const foodAmount = Math.round(salary * foodPercent / 100)
  const paidExpenses = expenses.filter((e) => e.isPaid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const pendingExpenses = expenses.filter((e) => !e.isPaid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const pendingExpensesWithoutRent = expenses
    .filter((e) => !e.isPaid && !String(e.title || '').includes('Alquiler'))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const loanPaid = loans.filter((l) => l.isPaid).reduce((sum, l) => sum + Number(l.amountThisMonthPesos || 0), 0)
  const loanPending = loans.filter((l) => !l.isPaid).reduce((sum, l) => sum + Number(l.amountThisMonthPesos || 0), 0)
  const committed = foodAmount + paidExpenses + pendingExpenses + loanPaid + loanPending
  return {
    month,
    config: config || { month, salary: 0, foodPercent: 30, notes: '' },
    summary: {
      salary,
      foodPercent,
      foodAmount,
      paidExpenses,
      pendingExpenses,
      pendingExpensesWithoutRent,
      loanPaid,
      loanPending,
      committed,
      estimatedBalance: salary - committed,
      paidTotal: paidExpenses + loanPaid,
      pendingTotal: pendingExpenses + loanPending,
      pendingTotalWithoutRent: pendingExpensesWithoutRent + loanPending,
    },
    expenses,
    loans,
  }
}

async function getLocalDashboard(db, month) {
  ensureLocalFixedExpensesForMonth(db, month)
  const config = db.monthConfigs.find((item) => item.month === month)
  const expenses = db.expenses.filter((item) => item.month === month).sort((a, b) => b.date.localeCompare(a.date))
  const loans = db.loans.map((loan) => loanForMonth(loan, month)).filter(Boolean)
  const salary = config?.salary || 0
  const foodPercent = config?.foodPercent ?? 30
  const foodAmount = Math.round(salary * foodPercent / 100)
  const paidExpenses = expenses.filter((e) => e.isPaid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const pendingExpenses = expenses.filter((e) => !e.isPaid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const pendingExpensesWithoutRent = expenses
    .filter((e) => !e.isPaid && !String(e.title || '').includes('Alquiler'))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const loanPaid = loans.filter((l) => l.isPaid).reduce((sum, l) => sum + Number(l.amountThisMonthPesos || 0), 0)
  const loanPending = loans.filter((l) => !l.isPaid).reduce((sum, l) => sum + Number(l.amountThisMonthPesos || 0), 0)
  const committed = foodAmount + paidExpenses + pendingExpenses + loanPaid + loanPending

  return {
    month,
    config: config || { month, salary: 0, foodPercent: 30, notes: '' },
    summary: {
      salary,
      foodPercent,
      foodAmount,
      paidExpenses,
      pendingExpenses,
      pendingExpensesWithoutRent,
      loanPaid,
      loanPending,
      committed,
      estimatedBalance: salary - committed,
      paidTotal: paidExpenses + loanPaid,
      pendingTotal: pendingExpenses + loanPending,
      pendingTotalWithoutRent: pendingExpensesWithoutRent + loanPending,
    },
    expenses,
    loans,
  }
}

async function localHandler(req, res, url, resource, id) {
  const db = await readLocalDb()

  if (resource === 'dashboard' && req.method === 'GET') {
    const dashboard = await getLocalDashboard(db, url.searchParams.get('month') || getMonth())
    await writeLocalDb(db)
    return send(res, 200, dashboard)
  }

  if (resource === 'config') {
    if (req.method === 'GET') {
      const month = url.searchParams.get('month') || getMonth()
      return send(res, 200, db.monthConfigs.find((item) => item.month === month) || { month, salary: 0, foodPercent: 30, notes: '' })
    }
    if (req.method === 'POST') {
      const body = await readBody(req)
      const current = db.monthConfigs.find((item) => item.month === body.month)
      const saved = { ...(current || {}), ...body, updatedAt: new Date().toISOString() }
      if (!current) {
        saved._id = randomUUID()
        saved.createdAt = new Date().toISOString()
        db.monthConfigs.push(saved)
      } else {
        Object.assign(current, saved)
      }
      await writeLocalDb(db)
      return send(res, 200, saved)
    }
  }

  if (resource === 'expenses') {
    if (req.method === 'POST') {
      const body = await readBody(req)
      const now = new Date().toISOString()
      const expenses = buildExpenseInstallments(body).map((expense) => ({
        _id: randomUUID(),
        ...expense,
        createdAt: now,
        updatedAt: now,
      }))
      db.expenses.push(...expenses)
      await writeLocalDb(db)
      return send(res, 201, { created: expenses, expense: expenses[0] })
    }
    if (req.method === 'PATCH' && id) {
      const expense = db.expenses.find((item) => item._id === id)
      if (!expense) return send(res, 404, { error: 'Not found' })
      Object.assign(expense, await readBody(req), { updatedAt: new Date().toISOString() })
      await writeLocalDb(db)
      return send(res, 200, expense)
    }
    if (req.method === 'DELETE' && id) {
      db.expenses = db.expenses.filter((item) => item._id !== id)
      await writeLocalDb(db)
      return send(res, 200, { ok: true })
    }
  }

  if (resource === 'loans') {
    if (req.method === 'POST') {
      const body = await readBody(req)
      const normalized = normalizeLoanTimeline(body)
      const averageInstallment = getAverageInstallment(normalized)
      const loan = {
        _id: randomUUID(),
        ...normalized,
        averageInstallment,
        payments: buildLoanPayments({ ...normalized, averageInstallment }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      db.loans.push(loan)
      await writeLocalDb(db)
      return send(res, 201, loan)
    }
    if (req.method === 'PATCH' && id) {
      const loan = db.loans.find((item) => item._id === id)
      if (!loan) return send(res, 404, { error: 'Not found' })
      const body = await readBody(req)
      const next = normalizeLoanTimeline({ ...loan, ...body })
      next.averageInstallment = getAverageInstallment(next)
      next.payments = buildLoanPayments(next, loan.payments || [])
      Object.assign(loan, next, { updatedAt: new Date().toISOString() })
      await writeLocalDb(db)
      return send(res, 200, loan)
    }
  }

  if (resource === 'loan-payment' && req.method === 'POST') {
    const body = await readBody(req)
    const loan = db.loans.find((item) => item._id === body.loanId)
    if (!loan) return send(res, 404, { error: 'Not found' })
    const payment = loan.payments.find((item) => item.month === body.month)
    if (!payment) return send(res, 404, { error: 'Not found' })
    Object.assign(payment, { isPaid: body.isPaid, paidAt: body.isPaid ? new Date().toISOString() : '', amount: body.amount })
    await writeLocalDb(db)
    return send(res, 200, loan)
  }

  return send(res, 404, { error: 'Not found' })
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const resource = parts[0] || 'dashboard'
    const id = parts[1]

    if (resource === 'health') return send(res, 200, { ok: true })
    if (!process.env.MONGODB_URI) {
      if (process.env.VERCEL) {
        return send(res, 500, {
          error: 'Missing MONGODB_URI. Configure MONGODB_URI in Vercel environment variables.',
        })
      }
      return localHandler(req, res, url, resource, id)
    }

    await connectDb()

    if (resource === 'dashboard' && req.method === 'GET') {
      return send(res, 200, await getDashboard(url.searchParams.get('month') || getMonth()))
    }

    if (resource === 'config') {
      if (req.method === 'GET') {
        const month = url.searchParams.get('month') || getMonth()
        const config = await MonthConfig.findOne({ month }).lean()
        return send(res, 200, config || { month, salary: 0, foodPercent: 30, notes: '' })
      }
      if (req.method === 'POST') {
        const body = await readBody(req)
        const config = await MonthConfig.findOneAndUpdate(
          { month: body.month },
          { $set: body },
          { new: true, upsert: true, runValidators: true }
        ).lean()
        return send(res, 200, config)
      }
    }

    if (resource === 'expenses') {
      if (req.method === 'POST') {
        const body = await readBody(req)
        const payloads = buildExpenseInstallments(body)
        const expenses = await Expense.insertMany(payloads)
        return send(res, 201, { created: expenses, expense: expenses[0] })
      }
      if (req.method === 'PATCH' && id) {
        const body = await readBody(req)
        const expense = await Expense.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
        return send(res, 200, expense)
      }
      if (req.method === 'DELETE' && id) {
        await Expense.findByIdAndDelete(id)
        return send(res, 200, { ok: true })
      }
    }

    if (resource === 'loans') {
      if (req.method === 'POST') {
        const body = await readBody(req)
        const normalized = normalizeLoanTimeline(body)
        const averageInstallment = getAverageInstallment(normalized)
        const payments = buildLoanPayments({ ...normalized, averageInstallment })
        const loan = await Loan.create({ ...normalized, averageInstallment, payments })
        return send(res, 201, loan)
      }
      if (req.method === 'PATCH' && id) {
        const body = await readBody(req)
        const current = await Loan.findById(id).lean()
        if (!current) return send(res, 404, { error: 'Not found' })
        const next = normalizeLoanTimeline({ ...current, ...body })
        next.averageInstallment = getAverageInstallment(next)
        next.payments = buildLoanPayments(next, current.payments || [])
        const update = { ...next }
        delete update._id
        delete update.createdAt
        delete update.updatedAt
        const loan = await Loan.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
        return send(res, 200, loan)
      }
    }

    if (resource === 'loan-payment' && req.method === 'POST') {
      const body = await readBody(req)
      const loan = await Loan.findOneAndUpdate(
        { _id: body.loanId, 'payments.month': body.month },
        { $set: { 'payments.$.isPaid': body.isPaid, 'payments.$.paidAt': body.isPaid ? new Date().toISOString() : '', 'payments.$.amount': body.amount } },
        { new: true }
      ).lean()
      return send(res, 200, loan)
    }

    if (resource === 'rollover-fixed' && req.method === 'POST') {
      const body = await readBody(req)
      const fromMonth = body.fromMonth
      const toMonth = body.toMonth
      const fixed = await Expense.find({ month: fromMonth, isFixed: true }).lean()
      const existing = await Expense.find({ month: toMonth, isFixed: true }).lean()
      const existingKeys = new Set(existing.map((e) => `${e.title}-${e.amount}`))
      const created = []
      for (const e of fixed) {
        if (e.renewUntil && monthIndex(e.renewUntil) < monthIndex(toMonth)) continue
        const key = `${e.title}-${e.amount}`
        if (existingKeys.has(key)) continue
        const day = String(e.fixedDay || 1).padStart(2, '0')
        created.push(await Expense.create({
          title: e.title,
          amount: e.amount,
          date: `${toMonth}-${day}`,
          month: toMonth,
          category: e.category,
          type: 'fixed',
          paymentMethod: e.paymentMethod,
          creditCard: e.creditCard || '',
          isPaid: false,
          isFixed: true,
          fixedDay: e.fixedDay,
          renewUntil: e.renewUntil,
          notes: e.notes,
        }))
      }
      return send(res, 201, { created })
    }

    send(res, 404, { error: 'Not found' })
  } catch (error) {
    send(res, 500, { error: error.message })
  }
}

export default handler
