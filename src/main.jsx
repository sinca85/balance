import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  DatePicker,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DownOutlined,
  DollarOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'antd/dist/reset.css'
import './styles.css'

const { Text, Title } = Typography
const { TextArea } = Input

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const categories = [
  { value: 'general', label: 'General' },
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'comida', label: 'Comida' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'hijos', label: 'Hijos' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'salud', label: 'Salud' },
  { value: 'ocio', label: 'Ocio' },
]

const paymentMethods = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Debito' },
  { value: 'credito', label: 'Credito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercado pago', label: 'Mercado Pago' },
]

const creditCards = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'MasterCard' },
]

function paymentMethodLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label || value
}

function creditCardLabel(value) {
  return creditCards.find((card) => card.value === value)?.label || value
}

function normalizeLegacyPayment(expense) {
  if (expense?.paymentMethod === 'visa' || expense?.paymentMethod === 'mastercard') {
    return { paymentMethod: 'credito', creditCard: expense.paymentMethod }
  }
  return { paymentMethod: expense?.paymentMethod || 'efectivo', creditCard: expense?.creditCard || '' }
}

function formatLoanAmount(value, loanUnit = 'ars') {
  if (loanUnit === 'uva') return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value || 0)} UVA`
  return money.format(value || 0)
}

function expensePaidAmount(expense) {
  const amount = Number(expense?.amount || 0)
  if (expense?.paidAmount !== undefined && expense?.paidAmount !== null) {
    return Math.min(Math.max(Number(expense.paidAmount || 0), 0), amount)
  }
  return expense?.isPaid ? amount : 0
}

function expensePendingAmount(expense) {
  return Math.max(Number(expense?.amount || 0) - expensePaidAmount(expense), 0)
}

function expensePaymentStatus(expense) {
  const paid = expensePaidAmount(expense)
  const amount = Number(expense?.amount || 0)
  if (amount > 0 && paid >= amount) return 'paid'
  if (paid > 0) return 'partial'
  return 'pending'
}

function itemId(item) {
  return item?._id || item?.id || ''
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : { error: await res.text() }
  if (!res.ok) throw new Error(data.error || 'Error de API')
  return data
}

function StatTile({ icon, label, value, hint }) {
  return (
    <Card className="stat-card" variant="borderless">
      <Statistic title={label} value={value} prefix={icon} formatter={(v) => money.format(v)} />
      {hint && <Text className="stat-hint" type="secondary">{hint}</Text>}
    </Card>
  )
}

function SalaryStatTile({ month, config, summary, onSaved }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [salary, setSalary] = useState(summary?.salary || 0)
  const currentSalary = summary?.salary || 0

  async function save() {
    try {
      setSaving(true)
      await api('config', {
        method: 'POST',
        body: JSON.stringify({
          month,
          salary: Number(salary || 0),
          foodPercent: config?.foodPercent ?? summary?.foodPercent ?? 25,
          notes: config?.notes || '',
        }),
      })
      setOpen(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  function openEditor() {
    setSalary(currentSalary)
    setOpen(true)
  }

  const label = (
    <Space size={4} className="stat-title-action">
      <span>Sueldo</span>
      <Tooltip title="Editar sueldo">
        <Button
          type="text"
          size="small"
          shape="circle"
          icon={<EditOutlined />}
          onClick={(event) => {
            event.stopPropagation()
            openEditor()
          }}
          aria-label="Editar sueldo"
        />
      </Tooltip>
    </Space>
  )

  return (
    <>
      <StatTile icon={<DollarOutlined />} label={label} value={currentSalary} />
      <Modal
        title="Editar sueldo"
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" loading={saving} onClick={save}>Guardar</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Sueldo cobrado">
            <InputNumber min={0} controls={false} prefix="$" value={salary} onChange={(value) => setSalary(value ?? 0)} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function FoodStatTile({ month, config, summary, onSaved }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [percent, setPercent] = useState(summary?.foodPercent ?? 25)

  async function save() {
    try {
      setSaving(true)
      await api('config', {
        method: 'POST',
        body: JSON.stringify({
          month,
          salary: config?.salary || summary?.salary || 0,
          foodPercent: Number(percent || 0),
          notes: config?.notes || '',
        }),
      })
      setOpen(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const foodPercent = summary?.foodPercent ?? 25
  function openEditor() {
    setPercent(foodPercent)
    setOpen(true)
  }

  const label = (
    <Space size={4} className="stat-title-action">
      <span>{`Alimentos (${foodPercent}%)`}</span>
      <Tooltip title="Editar porcentaje">
        <Button
          type="text"
          size="small"
          shape="circle"
          icon={<EditOutlined />}
          onClick={(event) => {
            event.stopPropagation()
            openEditor()
          }}
          aria-label="Editar porcentaje de alimentos"
        />
      </Tooltip>
    </Space>
  )

  return (
    <>
      <StatTile icon={<WalletOutlined />} label={label} value={summary?.foodAmount || 0} />
      <Modal
        title="Editar alimentos"
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" loading={saving} onClick={save}>Guardar</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="% alimentos">
            <InputNumber min={0} max={100} controls={false} suffix="%" value={percent} onChange={(value) => setPercent(value ?? 0)} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function CategorySummary({ open, onToggle, totals = {} }) {
  return (
    <section className="category-summary" aria-label="Resumen por categorias">
      <Button
        className="category-summary-toggle"
        type="text"
        size="small"
        icon={<DownOutlined rotate={open ? 180 : 0} />}
        onClick={onToggle}
      >
        Categorias
      </Button>
      {open && (
        <div className="category-summary-row">
          {categories.map((item) => (
            <span className="category-summary-pill" key={item.value}>
              <span>{item.label}</span>
              <strong>{money.format(totals[item.value] || 0)}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

const savingsStorageKey = 'balance.savings-simulations.v1'

function monthValue(value) {
  return value?.format('YYYY-MM') || value
}

function monthRange(start, end) {
  const months = []
  let cursor = dayjs(`${start}-01`)
  const last = dayjs(`${end}-01`)
  while (cursor.isBefore(last) || cursor.isSame(last, 'month')) {
    months.push(cursor.format('YYYY-MM'))
    cursor = cursor.add(1, 'month')
  }
  return months
}

function monthDays(month) {
  return dayjs(`${month}-01`).daysInMonth()
}

function emptySavingsItem(index = 1) {
  return {
    id: `savings-${Date.now()}-${index}`,
    name: index === 1 ? 'Plazo fijo' : `Ahorro ${index}`,
    method: 'fixed-term',
    monthlyContribution: 100000,
    annualRate: 40,
  }
}

function savingsItemSchedule(item, months, marketHistory) {
  let balance = 0
  let shares = 0
  return months.map((month) => {
    const contribution = Math.max(Number(item.monthlyContribution || 0), 0)
    if (item.method === 'market') {
      const price = marketHistory?.prices?.[month]
      if (!price) return { month, contribution: 0, interest: 0, balance: 0, unavailable: true }
      const previousBalance = balance
      shares += contribution / price
      balance = shares * price
      const interest = balance - previousBalance - contribution
      return { month, contribution, interest, balance, shares, price }
    }
    const base = balance + contribution
    const annualRate = Math.max(Number(item.annualRate || 0), 0) / 100
    const rate = item.method === 'fixed-term'
      ? Math.pow(1 + annualRate, 1 / 12) - 1
      : Math.pow(1 + annualRate, 1 / 365) - 1
    const interest = base * (Math.pow(1 + rate, item.method === 'fixed-term' ? 1 : monthDays(month)) - 1)
    balance = base + interest
    return { month, contribution, interest, balance }
  })
}

function formatSavingsNumber(value) {
  return money.format(Math.round(value || 0))
}

function SavingsSimulator() {
  const defaultStart = dayjs().format('YYYY-MM')
  const defaultEnd = dayjs().add(12, 'month').format('YYYY-MM')
  const [loading, setLoading] = useState(true)
  const [savingSimulation, setSavingSimulation] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [marketHistory, setMarketHistory] = useState({})
  const [startMonth, setStartMonth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(savingsStorageKey) || 'null')?.startMonth || defaultStart
    } catch {
      return defaultStart
    }
  })
  const [endMonth, setEndMonth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(savingsStorageKey) || 'null')?.endMonth || defaultEnd
    } catch {
      return defaultEnd
    }
  })
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(savingsStorageKey) || 'null')
      return Array.isArray(saved?.items) && saved.items.length ? saved.items : [emptySavingsItem()]
    } catch {
      return [emptySavingsItem()]
    }
  })
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(savingsStorageKey) || 'null')?.saved || false
    } catch {
      return false
    }
  })

  useEffect(() => {
    let ignore = false
    api('savings')
      .then((state) => {
        if (ignore) return
        if (state.startMonth) setStartMonth(state.startMonth)
        if (state.endMonth) setEndMonth(state.endMonth)
        if (Array.isArray(state.items) && state.items.length) setItems(state.items)
        setStorageError('')
      })
      .catch((error) => {
        if (!ignore) setStorageError(error.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const validRange = startMonth <= endMonth
  const months = useMemo(() => validRange ? monthRange(startMonth, endMonth) : [], [startMonth, endMonth, validRange])
  const marketSymbols = useMemo(() => [...new Set(items.filter((item) => item.method === 'market').map((item) => item.asset || 'MELI'))], [items])
  useEffect(() => {
    if (!validRange || !marketSymbols.length) return undefined
    let ignore = false
    Promise.all(marketSymbols.map(async (symbol) => [symbol, await api(`market-history?symbol=${symbol}&start=${startMonth}&end=${endMonth}`)]))
      .then((results) => {
        if (!ignore) setMarketHistory(Object.fromEntries(results))
      })
      .catch((error) => {
        if (!ignore) setStorageError(error.message)
      })
    return () => { ignore = true }
  }, [endMonth, marketSymbols, startMonth, validRange])
  const schedules = useMemo(() => items.map((item) => ({
    item,
    rows: savingsItemSchedule(item, months, marketHistory[item.asset || 'MELI']),
  })), [items, marketHistory, months])
  const totals = useMemo(() => months.map((month, index) => schedules.reduce((acc, schedule) => {
    const row = schedule.rows[index]
    acc.contribution += row?.contribution || 0
    acc.interest += row?.interest || 0
    acc.balance += row?.balance || 0
    return acc
  }, { month, contribution: 0, interest: 0, balance: 0 })), [months, schedules])
  const finalTotal = totals.at(-1)?.balance || 0
  const totalContributions = totals.reduce((sum, row) => sum + row.contribution, 0)
  const totalInterest = finalTotal - totalContributions

  const methodTotals = useMemo(() => schedules.map(({ item, rows }) => {
    const contributions = rows.reduce((sum, row) => sum + row.contribution, 0)
    const interest = rows.reduce((sum, row) => sum + row.interest, 0)
    return { item, contributions, interest, balance: rows.at(-1)?.balance || 0 }
  }), [schedules])
  const rankedMethods = useMemo(() => [...methodTotals].sort((a, b) => b.balance - a.balance), [methodTotals])
  const bestMethodBalance = rankedMethods[0]?.balance || 0

  function updateItem(id, patch) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
    setSaved(false)
  }

  function addItem() {
    setItems((current) => [...current, emptySavingsItem(current.length + 1)])
    setSaved(false)
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id))
    setSaved(false)
  }

  async function saveSimulation() {
    try {
      setSavingSimulation(true)
      const state = await api('savings', {
        method: 'POST',
        body: JSON.stringify({ startMonth, endMonth, items }),
      })
      localStorage.setItem(savingsStorageKey, JSON.stringify({ ...state, saved: true }))
      setSaved(true)
      setStorageError('')
    } catch (error) {
      setSaved(false)
      setStorageError(error.message)
    } finally {
      setSavingSimulation(false)
    }
  }

  return (
    <section className="savings-section">
      <Flex justify="space-between" align="center" className="section-title">
        <Space align="center">
          <Title level={3}>Simulador de ahorro</Title>
          <Tag color="blue">Local</Tag>
        </Space>
        <Button type="primary" loading={savingSimulation} onClick={saveSimulation}>Guardar simulación</Button>
      </Flex>
      <Card className="savings-card" variant="borderless">
        {storageError && <Alert className="savings-alert" type="error" showIcon message="No se pudo acceder al almacenamiento persistente" description={storageError} />}
        {loading && <Text type="secondary">Cargando simulación guardada...</Text>}
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} md={5}>
            <Text className="control-label">Desde</Text>
            <DatePicker picker="month" value={dayjs(`${startMonth}-01`)} onChange={(value) => setStartMonth(monthValue(value))} allowClear={false} />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Text className="control-label">Hasta</Text>
            <DatePicker picker="month" value={dayjs(`${endMonth}-01`)} onChange={(value) => setEndMonth(monthValue(value))} allowClear={false} />
          </Col>
          <Col xs={24} md={14}>
            <Text type="secondary">Cada método aporta al comienzo de cada mes y reinvierte los intereses automáticamente.</Text>
          </Col>
        </Row>
        {!validRange && <Alert className="savings-alert" type="warning" showIcon message="La fecha final debe ser igual o posterior a la inicial." />}

        <Divider />
        <Space orientation="vertical" size={12} className="savings-items">
          {items.map((item) => (
            <Card key={item.id} size="small" className="savings-item" variant="outlined">
              <Row gutter={[10, 10]} align="bottom">
                <Col xs={24} sm={12} md={5}>
                  <Text className="control-label">Nombre</Text>
                  <Input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                </Col>
                <Col xs={24} sm={12} md={5}>
                  <Text className="control-label">Método</Text>
                  <Select
                    value={item.method}
                    onChange={(value) => updateItem(item.id, { method: value })}
                    options={[{ value: 'fixed-term', label: 'Plazo fijo mensual' }, { value: 'caucion', label: 'Caución diaria' }, { value: 'market', label: 'Inversión bursátil' }]}
                  />
                </Col>
                {item.method === 'market' && <Col xs={24} sm={12} md={5}>
                  <Text className="control-label">Ticker</Text>
                  <Input
                    value={item.asset || 'MELI'}
                    onChange={(event) => updateItem(item.id, { asset: event.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, '') })}
                    placeholder="Ej. MELI"
                    maxLength={15}
                  />
                </Col>}
                <Col xs={24} sm={12} md={5}>
                  <Text className="control-label">Aporte mensual</Text>
                  <InputNumber min={0} controls={false} prefix="$" value={item.monthlyContribution} onChange={(value) => updateItem(item.id, { monthlyContribution: value ?? 0 })} />
                </Col>
                {item.method !== 'market' && <Col xs={24} sm={12} md={5}>
                  <Text className="control-label">Tasa anual</Text>
                  <InputNumber min={0} controls={false} suffix="%" value={item.annualRate} onChange={(value) => updateItem(item.id, { annualRate: value ?? 0 })} />
                </Col>}
                <Col xs={24} md={4}>
                  <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(item.id)} disabled={items.length === 1}>Quitar</Button>
                </Col>
              </Row>
            </Card>
          ))}
        </Space>
        <Button className="savings-add" icon={<PlusOutlined />} onClick={addItem}>Agregar método</Button>

        {validRange && (
          <>
            <Divider />
            <Row gutter={[12, 12]} className="savings-summary">
              <Col xs={24} sm={8}><Statistic title="Aportes totales" value={totalContributions} formatter={(value) => formatSavingsNumber(value)} /></Col>
              <Col xs={24} sm={8}><Statistic title="Intereses estimados" value={totalInterest} formatter={(value) => formatSavingsNumber(value)} /></Col>
              <Col xs={24} sm={8}><Statistic title="Saldo final estimado" value={finalTotal} formatter={(value) => formatSavingsNumber(value)} /></Col>
            </Row>
            <section className="savings-comparison" aria-label="Comparación de métodos de ahorro">
              <Flex justify="space-between" align="center" className="savings-subsection-title">
                <Title level={4}>Comparación por método</Title>
                <Text type="secondary">Ordenado por saldo final</Text>
              </Flex>
              <Row gutter={[12, 12]}>
                {rankedMethods.map(({ item, contributions, interest, balance }, index) => (
                  <Col key={item.id} xs={24} sm={12} lg={6}>
                    <Card className="savings-method-card" size="small">
                      <Flex justify="space-between" align="start" gap={8}>
                        <div>
                          <Text strong>{item.name || 'Sin nombre'}</Text>
                          <Text className="savings-method-type" type="secondary">
                            {item.method === 'fixed-term' ? 'Plazo fijo mensual' : item.method === 'caucion' ? 'Caución diaria' : `Ticker ${(item.asset || 'MELI').toUpperCase()} · histórico`}
                          </Text>
                        </div>
                        {index === 0 && <Tag color="green">Mejor saldo</Tag>}
                      </Flex>
                      <Statistic title="Saldo final" value={balance} formatter={(value) => formatSavingsNumber(value)} />
                      <Progress percent={bestMethodBalance ? Math.round((balance / bestMethodBalance) * 100) : 0} showInfo={false} strokeColor="#1677ff" />
                      <div className="savings-method-metrics">
                        <span><Text type="secondary">Aportes</Text><strong>{formatSavingsNumber(contributions)}</strong></span>
                        <span><Text type="secondary">Intereses</Text><strong>{formatSavingsNumber(interest)}</strong></span>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </section>
            <div className="savings-table-wrap">
              <table className="savings-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Mes</th>
                    {schedules.map(({ item }) => <th key={item.id} colSpan="3" className="savings-method-heading">{item.name || 'Sin nombre'}</th>)}
                    <th colSpan="3" className="savings-total-heading">Total</th>
                  </tr>
                  <tr>
                    {schedules.flatMap(({ item }) => [
                      <th key={`${item.id}-contribution`}>Aporte</th>,
                      <th key={`${item.id}-interest`}>Interés</th>,
                      <th key={`${item.id}-balance`}>Acumulado</th>,
                    ])}
                    <th>Aportes</th><th>Interés</th><th>Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((row, index) => (
                    <tr key={row.month}>
                      <td>{dayjs(`${row.month}-01`).format('MMM YYYY')}</td>
                      {schedules.flatMap(({ item, rows }) => {
                        const methodRow = rows[index]
                        return [
                          <td key={`${item.id}-${row.month}-contribution`}>{formatSavingsNumber(methodRow?.contribution)}</td>,
                          <td key={`${item.id}-${row.month}-interest`}>{formatSavingsNumber(methodRow?.interest)}</td>,
                          <td key={`${item.id}-${row.month}-balance`}><strong>{formatSavingsNumber(methodRow?.balance)}</strong></td>,
                        ]
                      })}
                      <td>{formatSavingsNumber(row.contribution)}</td>
                      <td>{formatSavingsNumber(row.interest)}</td>
                      <td><strong>{formatSavingsNumber(row.balance)}</strong></td>
                    </tr>
                  ))}
                  <tr className="savings-table-total-row">
                    <td>Total período</td>
                    {methodTotals.flatMap(({ item, contributions, interest, balance }) => [
                      <td key={`${item.id}-total-contribution`}>{formatSavingsNumber(contributions)}</td>,
                      <td key={`${item.id}-total-interest`}>{formatSavingsNumber(interest)}</td>,
                      <td key={`${item.id}-total-balance`}><strong>{formatSavingsNumber(balance)}</strong></td>,
                    ])}
                    <td>{formatSavingsNumber(totalContributions)}</td>
                    <td>{formatSavingsNumber(totalInterest)}</td>
                    <td><strong>{formatSavingsNumber(finalTotal)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        {saved && <Text className="savings-saved" type="success">Simulación guardada localmente en este dispositivo.</Text>}
      </Card>
    </section>
  )
}

function Toolbar({ month, setMonth, category, setCategory, paymentMethod, setPaymentMethod, status, setStatus }) {
  return (
    <Card className="toolbar-card" variant="borderless">
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} md={6}>
          <Text className="control-label">Mes</Text>
          <DatePicker picker="month" value={dayjs(month)} onChange={(value) => value && setMonth(value.format('YYYY-MM'))} allowClear={false} />
        </Col>
        <Col xs={24} md={6}>
          <Text className="control-label">Categoria</Text>
          <Select
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'Todas' }, ...categories]}
          />
        </Col>
        <Col xs={24} md={6}>
          <Text className="control-label">Medio</Text>
          <Select
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              { value: 'all', label: 'Todos' },
              ...paymentMethods,
              { value: 'credito:visa', label: 'Credito Visa' },
              { value: 'credito:mastercard', label: 'Credito MasterCard' },
            ]}
          />
        </Col>
        <Col xs={24} md={6}>
          <Text className="control-label">Estado</Text>
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'paid', label: 'Pagos' },
              { value: 'pending', label: 'Pendientes' },
            ]}
          />
        </Col>
      </Row>
    </Card>
  )
}

function ConfigPanel({ config, month, onSaved }) {
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      salary: config?.salary || 0,
      foodPercent: config?.foodPercent ?? 25,
      notes: config?.notes || '',
    })
  }, [config, form])

  async function save(values) {
    await api('config', { method: 'POST', body: JSON.stringify({ month, ...values }) })
    onSaved()
  }

  return (
    <Card title={<Space><WalletOutlined />Datos globales del mes</Space>} variant="borderless">
      <Form layout="vertical" form={form} onFinish={save}>
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item label="Sueldo cobrado" name="salary">
              <InputNumber min={0} controls={false} prefix="$" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="% alimentos" name="foodPercent">
              <InputNumber min={0} max={100} controls={false} suffix="%" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Notas" name="notes">
          <TextArea rows={3} placeholder="Ej: sueldo mayo cobrado en junio, ajuste pendiente, embargo..." />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          Guardar mes
        </Button>
      </Form>
    </Card>
  )
}

function ExpenseForm({ month, editingExpense, onSaved, onCancelEdit }) {
  const [form] = Form.useForm()
  const selectedPaymentMethod = Form.useWatch('paymentMethod', form)
  const isCredit = selectedPaymentMethod === 'credito'

  useEffect(() => {
    if (editingExpense) {
      const payment = normalizeLegacyPayment(editingExpense)
      form.setFieldsValue({
        title: editingExpense.title,
        amount: editingExpense.amount,
        date: dayjs(editingExpense.date),
        category: editingExpense.category || 'general',
        paymentMethod: payment.paymentMethod,
        creditCard: payment.creditCard || undefined,
        installments: editingExpense.installments || 1,
        isPaid: expensePaymentStatus(editingExpense) === 'paid',
        isFixed: Boolean(editingExpense.isFixed),
        notes: editingExpense.notes || '',
      })
      return
    }
    form.setFieldsValue({ date: dayjs(`${month}-01`), category: 'general', paymentMethod: 'efectivo', creditCard: undefined, installments: 1, isPaid: false, isFixed: false })
  }, [month, form, editingExpense])

  async function submit(values) {
    const currentPaidAmount = editingExpense ? expensePaidAmount(editingExpense) : 0
    const shouldKeepPartialPayment = editingExpense && expensePaymentStatus(editingExpense) === 'partial'
    const payload = {
      ...values,
      amount: Number(values.amount),
      date: values.date.format('YYYY-MM-DD'),
      month: editingExpense?.month || month,
      type: values.isFixed ? 'fixed' : 'variable',
      creditCard: values.paymentMethod === 'credito' ? values.creditCard || '' : '',
      installments: values.paymentMethod === 'credito' ? Number(values.installments || 1) : 1,
      paidAmount: values.isPaid ? Number(values.amount) : (shouldKeepPartialPayment ? currentPaidAmount : 0),
    }
    const expenseId = itemId(editingExpense)
    if (editingExpense && !expenseId) throw new Error('No pude identificar el gasto para editar')
    await api(editingExpense ? `expenses/${expenseId}` : 'expenses', {
      method: editingExpense ? 'PATCH' : 'POST',
      body: JSON.stringify({
        ...payload,
        fixedDay: Number(payload.date.slice(8, 10)) || null,
      }),
    })
    form.resetFields()
    form.setFieldsValue({ date: dayjs(`${month}-01`), category: 'general', paymentMethod: 'efectivo', creditCard: undefined, installments: 1 })
    onSaved()
  }

  return (
    <Card
      title={<Space><PlusOutlined />{editingExpense ? 'Editar gasto' : 'Nuevo gasto'}</Space>}
      extra={editingExpense && <Button type="text" onClick={onCancelEdit}>Cancelar</Button>}
      variant="borderless"
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={submit}
        initialValues={{ category: 'general', paymentMethod: 'efectivo', installments: 1, isPaid: false, isFixed: false, date: dayjs(`${month}-01`) }}
      >
        <Form.Item label="Detalle" name="title" rules={[{ required: true, message: 'Agrega un detalle' }]}>
          <Input placeholder="Alquiler, supermercado, tarjeta..." />
        </Form.Item>
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item label="Monto" name="amount" rules={[{ required: true, message: 'Agrega un monto' }]}>
              <InputNumber min={0} controls={false} prefix="$" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Fecha" name="date">
              <DatePicker allowClear={false} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item label="Categoria" name="category">
              <Select options={categories} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Medio" name="paymentMethod">
              <Select options={paymentMethods} />
            </Form.Item>
          </Col>
          {isCredit && (
            <Col span={12}>
              <Form.Item label="Tarjeta" name="creditCard" rules={[{ required: true, message: 'Elegi Visa o MasterCard' }]}>
                <Select options={creditCards} />
              </Form.Item>
            </Col>
          )}
          {isCredit && (
            <Col span={12}>
              <Form.Item label="Cuotas" name="installments">
                <InputNumber min={1} controls={false} />
              </Form.Item>
            </Col>
          )}
        </Row>
        <Form.Item name="isPaid" valuePropName="checked">
          <Checkbox>Ya esta pago</Checkbox>
        </Form.Item>
        <Form.Item name="isFixed" valuePropName="checked">
          <Checkbox>Es gasto fijo mensual</Checkbox>
        </Form.Item>
        <Form.Item label="Notas" name="notes">
          <TextArea rows={3} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {editingExpense ? 'Guardar cambios' : 'Agregar gasto'}
        </Button>
      </Form>
    </Card>
  )
}

function LoanForm({ month, editingLoan, onSaved, onCancelEdit }) {
  const [form] = Form.useForm()
  const loanUnit = Form.useWatch('loanUnit', form) || 'ars'
  const isUva = loanUnit === 'uva'

  useEffect(() => {
    if (editingLoan) {
      form.setFieldsValue({
        title: editingLoan.title,
        lender: editingLoan.lender || '',
        startMonth: dayjs(editingLoan.startMonth),
        loanUnit: editingLoan.loanUnit || 'ars',
        principal: editingLoan.principal,
        totalToReturn: editingLoan.totalToReturn,
        averageInstallment: editingLoan.averageInstallment,
        currentInstallment: editingLoan.currentInstallment || editingLoan.installmentNumber || 1,
        uvaValue: editingLoan.uvaValue || 0,
        installments: editingLoan.installments,
        paymentDay: editingLoan.paymentDay,
        notes: editingLoan.notes || '',
      })
      return
    }
    form.setFieldsValue({ startMonth: dayjs(month), loanUnit: 'ars', installments: 6, currentInstallment: 1, paymentDay: 10 })
  }, [month, form, editingLoan])

  async function submit(values) {
    await api(editingLoan ? `loans/${editingLoan._id}` : 'loans', {
      method: editingLoan ? 'PATCH' : 'POST',
      body: JSON.stringify({
        ...values,
        startMonth: values.startMonth.format('YYYY-MM'),
        currentMonth: month,
        loanUnit: values.loanUnit || 'ars',
        principal: Number(values.principal),
        totalToReturn: Number(values.totalToReturn),
        averageInstallment: values.averageInstallment ? Number(values.averageInstallment) : undefined,
        uvaValue: values.loanUnit === 'uva' ? Number(values.uvaValue || 0) : 0,
        installments: Number(values.installments),
        currentInstallment: Number(values.currentInstallment || 1),
        paymentDay: Number(values.paymentDay),
      }),
    })
    form.resetFields()
    form.setFieldsValue({ startMonth: dayjs(month), loanUnit: 'ars', installments: 6, currentInstallment: 1, paymentDay: 10 })
    onSaved()
  }

  return (
    <Card
      title={<Space><CreditCardOutlined />{editingLoan ? 'Editar prestamo / credito' : 'Nuevo prestamo / credito'}</Space>}
      extra={editingLoan && <Button type="text" onClick={onCancelEdit}>Cancelar</Button>}
      variant="borderless"
    >
      <Form layout="vertical" form={form} onFinish={submit} initialValues={{ startMonth: dayjs(month), loanUnit: 'ars', installments: 6, currentInstallment: 1, paymentDay: 10 }}>
        <Form.Item label="Nombre" name="title" rules={[{ required: true, message: 'Agrega un nombre' }]}>
          <Input placeholder="Prestamo Galicia, tarjeta, deuda..." />
        </Form.Item>
        <Row gutter={10}>
          <Col span={8}>
            <Form.Item label="Entidad" name="lender">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Inicio" name="startMonth">
              <DatePicker picker="month" allowClear={false} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Tipo" name="loanUnit">
              <Select
                options={[
                  { value: 'ars', label: 'Pesos' },
                  { value: 'uva', label: 'UVA' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item label={isUva ? 'UVAs pedidas' : 'Capital pedido'} name="principal" rules={[{ required: true, message: 'Agrega el capital' }]}>
              <InputNumber min={0} controls={false} prefix={isUva ? undefined : '$'} suffix={isUva ? 'UVA' : undefined} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={isUva ? 'UVAs que debo' : 'Total a devolver'} name="totalToReturn" rules={[{ required: true, message: 'Agrega el total' }]}>
              <InputNumber min={0} controls={false} prefix={isUva ? undefined : '$'} suffix={isUva ? 'UVA' : undefined} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={10}>
          <Col span={8}>
            <Form.Item label="Cuotas" name="installments">
              <InputNumber min={1} controls={false} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Cuota de este mes" name="currentInstallment">
              <InputNumber min={1} controls={false} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={isUva ? 'Valor cuota (UVA)' : 'Valor cuota'} name="averageInstallment">
              <InputNumber min={0} controls={false} prefix={isUva ? undefined : '$'} suffix={isUva ? 'UVA' : undefined} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item label="Dia de pago" name="paymentDay">
              <InputNumber min={1} max={31} controls={false} />
            </Form.Item>
          </Col>
          {isUva && (
            <Col span={12}>
              <Form.Item label="Valor UVA actual" name="uvaValue" rules={[{ required: true, message: 'Agrega el valor UVA' }]}>
                <InputNumber min={0} controls={false} prefix="$" />
              </Form.Item>
            </Col>
          )}
        </Row>
        <Form.Item label="Notas" name="notes">
          <TextArea rows={3} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {editingLoan ? 'Guardar cambios' : 'Crear prestamo'}
        </Button>
      </Form>
    </Card>
  )
}

function ExpenseCard({ expense, reload, onEdit }) {
  const payment = normalizeLegacyPayment(expense)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentForm] = Form.useForm()
  const expenseId = itemId(expense)
  const paidAmount = expensePaidAmount(expense)
  const pendingAmount = expensePendingAmount(expense)
  const paymentStatus = expensePaymentStatus(expense)

  useEffect(() => {
    if (paymentModalOpen) paymentForm.setFieldsValue({ paidAmount })
  }, [paymentModalOpen, paymentForm, paidAmount])

  async function savePayment(values) {
    if (!expenseId) throw new Error('No pude identificar el gasto para registrar el pago')
    await api(`expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify({ paidAmount: Number(values.paidAmount || 0) }) })
    setPaymentModalOpen(false)
    reload()
  }

  async function remove() {
    if (!expenseId) throw new Error('No pude identificar el gasto para borrar')
    await api(`expenses/${expenseId}`, { method: 'DELETE' })
    reload()
  }

  return (
    <Card
      className={paymentStatus === 'paid' ? 'item-card item-card-paid' : 'item-card'}
      variant="borderless"
      actions={[
        <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(expense)}>
          Editar
        </Button>,
        <Button type="text" icon={<CheckCircleOutlined />} onClick={() => setPaymentModalOpen(true)}>
          Registrar pago
        </Button>,
        <Button type="text" danger icon={<DeleteOutlined />} onClick={remove}>
          Borrar
        </Button>,
      ]}
    >
      <Flex justify="space-between" gap={12} align="flex-start">
        <div>
          <Title level={5}>{expense.title}</Title>
          <Text type="secondary">
            {expense.category} · {paymentMethodLabel(payment.paymentMethod)}
            {payment.paymentMethod === 'credito' && payment.creditCard ? ` ${creditCardLabel(payment.creditCard)}` : ''}
          </Text>
        </div>
        <Text strong className="amount">{money.format(expense.amount)}</Text>
      </Flex>
      <Space wrap className="tag-row">
        <Tag>{expense.date}</Tag>
        {expense.isFixed && <Tag color="gold" icon={<HomeOutlined />}>fijo</Tag>}
        {expense.installments > 1 && <Tag>Cuota {expense.installmentNumber}/{expense.installments}</Tag>}
        <Tag color={paymentStatus === 'paid' ? 'green' : paymentStatus === 'partial' ? 'blue' : 'orange'}>
          {paymentStatus === 'paid' ? 'pago' : paymentStatus === 'partial' ? 'parcial' : 'pendiente'}
        </Tag>
      </Space>
      {paidAmount > 0 && paymentStatus !== 'paid' && (
        <Flex className="payment-line" justify="space-between" gap={10}>
          <Text type="secondary">Pagado: <strong>{money.format(paidAmount)}</strong></Text>
          <Text type="secondary">Falta: <strong>{money.format(pendingAmount)}</strong></Text>
        </Flex>
      )}
      {expense.notes && <Text className="notes">{expense.notes}</Text>}
      <Modal
        title={`Registrar pago - ${expense.title}`}
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" form={paymentForm} onFinish={savePayment}>
          <Form.Item label="Monto pagado" name="paidAmount" rules={[{ required: true, message: 'Ingresa el monto pagado' }]}>
            <InputNumber min={0} max={Number(expense.amount || 0)} controls={false} prefix="$" />
          </Form.Item>
          <Flex gap={8} justify="space-between" align="center">
            <Text type="secondary">Total: {money.format(expense.amount || 0)}</Text>
            <Space>
              <Button onClick={() => paymentForm.setFieldsValue({ paidAmount: 0 })}>Limpiar</Button>
              <Button onClick={() => paymentForm.setFieldsValue({ paidAmount: Number(expense.amount || 0) })}>Todo</Button>
              <Button type="primary" htmlType="submit">Guardar</Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </Card>
  )
}

function LoanCard({ loan, month, reload, onEdit }) {
  const loanId = itemId(loan)

  async function toggle() {
    await api('loan-payment', { method: 'POST', body: JSON.stringify({ loanId, month, amount: loan.amountThisMonth, isPaid: !loan.isPaid }) })
    reload()
  }

  async function remove() {
    if (!loanId) throw new Error('No pude identificar el prestamo para borrar')
    await api(`loans/${loanId}`, { method: 'DELETE' })
    reload()
  }

  const pct = loan.installments ? Math.min(100, Math.round(((loan.paidInstallments || 0) / loan.installments) * 100)) : 0
  const isUva = loan.loanUnit === 'uva'
  const remainingInstallments = loan.remainingInstallments ?? Math.max((loan.installments || 0) - (loan.paidInstallments || 0), 0)

  return (
    <Card
      className={loan.isPaid ? 'item-card item-card-paid' : 'item-card'}
      variant="borderless"
      actions={[
        <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(loan)}>
          Editar
        </Button>,
        <Button type="text" icon={<CheckCircleOutlined />} onClick={toggle}>
          {loan.isPaid ? 'Marcar pendiente' : 'Marcar pago'}
        </Button>,
        <Button type="text" danger icon={<DeleteOutlined />} onClick={remove}>
          Borrar
        </Button>,
      ]}
    >
      <Flex justify="space-between" gap={12} align="flex-start">
        <div>
          <Title level={5}>{loan.title}</Title>
          <Text type="secondary">Cuota {loan.installmentNumber}/{loan.installments} · {loan.lender || 'sin entidad'} · {isUva ? 'UVA' : 'pesos'}</Text>
        </div>
        <div className="amount-block">
          <Text strong className="amount">{formatLoanAmount(loan.amountThisMonth, loan.loanUnit)}</Text>
          {isUva && <Text type="secondary">{money.format(loan.amountThisMonthPesos || 0)}</Text>}
        </div>
      </Flex>
      <Tooltip title={`${remainingInstallments} cuotas restantes`}>
        <Progress percent={pct} showInfo={false} strokeColor="#1677ff" />
      </Tooltip>
      <Row gutter={8}>
        <Col span={12}><Text type="secondary">Pagado: </Text><Text strong>{formatLoanAmount(loan.paidAmount, loan.loanUnit)}</Text></Col>
        <Col span={12}><Text type="secondary">Falta: </Text><Text strong>{formatLoanAmount(loan.remainingAmount, loan.loanUnit)}</Text></Col>
      </Row>
      <Space wrap className="tag-row">
        <Tag>Dia {loan.paymentDay}</Tag>
        {isUva && <Tag>UVA ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(loan.uvaValue || 0)}</Tag>}
        <Tag color={loan.isPaid ? 'green' : 'orange'}>{loan.isPaid ? 'cuota paga' : 'cuota pendiente'}</Tag>
      </Space>
      {loan.notes && <Text className="notes">{loan.notes}</Text>}
    </Card>
  )
}

function EntryModal({
  open,
  kind,
  mode,
  month,
  config,
  editingExpense,
  editingLoan,
  onKindChange,
  onClose,
  onSaved,
}) {
  return (
    <Modal
      open={open}
      title={mode === 'edit' ? 'Editar item' : 'Agregar item'}
      onCancel={onClose}
      footer={null}
      width={620}
      destroyOnHidden
    >
      <Space orientation="vertical" size={14} className="entry-modal">
        <div>
          <Text className="control-label">Tipo</Text>
          <Select
            value={kind}
            disabled={mode === 'edit'}
            onChange={onKindChange}
            options={[
              { value: 'config', label: 'Datos globales del mes' },
              { value: 'expense', label: 'Nuevo gasto' },
              { value: 'loan', label: 'Prestamo / credito' },
            ]}
          />
        </div>

        {kind === 'config' && <ConfigPanel config={config} month={month} onSaved={onSaved} />}
        {kind === 'expense' && (
          <ExpenseForm
            month={month}
            editingExpense={editingExpense}
            onCancelEdit={onClose}
            onSaved={onSaved}
          />
        )}
        {kind === 'loan' && (
          <LoanForm
            month={month}
            editingLoan={editingLoan}
            onCancelEdit={onClose}
            onSaved={onSaved}
          />
        )}
      </Space>
    </Modal>
  )
}

function AppContent() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [category, setCategory] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const [error, setError] = useState('')
  const [editingExpense, setEditingExpense] = useState(null)
  const [editingLoan, setEditingLoan] = useState(null)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [entryKind, setEntryKind] = useState('expense')
  const [entryMode, setEntryMode] = useState('create')
  const [refreshing, setRefreshing] = useState(false)
  const [showCategorySummary, setShowCategorySummary] = useState(false)
  const [activeSection, setActiveSection] = useState(() => window.location.hash === '#savings' ? 'savings' : 'balance')

  useEffect(() => {
    const onHashChange = () => setActiveSection(window.location.hash === '#savings' ? 'savings' : 'balance')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigateSection(section) {
    window.location.hash = section === 'savings' ? 'savings' : 'balance'
    setActiveSection(section)
  }

  async function load() {
    try {
      setError('')
      setData(await api(`dashboard?month=${month}`))
    } catch (e) {
      setError(e.message)
    }
  }

  async function refreshDashboard() {
    try {
      setRefreshing(true)
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let ignore = false
    api(`dashboard?month=${month}`)
      .then((dashboard) => {
        if (!ignore) {
          setError('')
          setData(dashboard)
        }
      })
      .catch((e) => {
        if (!ignore) setError(e.message)
      })
    return () => {
      ignore = true
    }
  }, [month])

  const filteredExpenses = useMemo(() => (data?.expenses || [])
    .filter((e) => {
      const payment = normalizeLegacyPayment(e)
      if (category !== 'all' && e.category !== category) return false
      if (paymentMethod.includes(':')) {
        const [method, card] = paymentMethod.split(':')
        if (payment.paymentMethod !== method || payment.creditCard !== card) return false
      } else if (paymentMethod !== 'all' && payment.paymentMethod !== paymentMethod) {
        return false
      }
      const paymentStatus = expensePaymentStatus(e)
      if (status === 'paid' && paymentStatus !== 'paid') return false
      if (status === 'pending' && paymentStatus === 'paid') return false
      return true
    })
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)), [data, category, paymentMethod, status])

  function openCreate() {
    setEntryMode('create')
    setEntryKind('expense')
    setEditingExpense(null)
    setEditingLoan(null)
    setEntryModalOpen(true)
  }

  function openEditExpense(expense) {
    setEntryMode('edit')
    setEntryKind('expense')
    setEditingExpense(expense)
    setEditingLoan(null)
    setEntryModalOpen(true)
  }

  function openEditLoan(loan) {
    setEntryMode('edit')
    setEntryKind('loan')
    setEditingLoan(loan)
    setEditingExpense(null)
    setEntryModalOpen(true)
  }

  function closeEntryModal() {
    setEntryModalOpen(false)
    setEntryMode('create')
    setEditingExpense(null)
    setEditingLoan(null)
  }

  function saveEntryModal() {
    closeEntryModal()
    load()
  }

  return (
    <main>
      <header className="hero">
        <nav className="site-nav" aria-label="Secciones">
          <Button type={activeSection === 'balance' ? 'primary' : 'text'} onClick={() => navigateSection('balance')}>Balance</Button>
          <Button type={activeSection === 'savings' ? 'primary' : 'text'} onClick={() => navigateSection('savings')}>Simulación de ahorro</Button>
        </nav>
        <Space orientation="vertical" size={6}>
          {activeSection === 'balance' && <Space align="center">
            <Tag color="blue" icon={<CalendarOutlined />}>Control mensual</Tag>
            <Tooltip title="Actualizar">
              <Button
                shape="circle"
                size="small"
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={refreshDashboard}
                aria-label="Actualizar"
              />
            </Tooltip>
          </Space>}
          <Text type="secondary">{activeSection === 'balance' ? 'Sueldo, alimentos, gastos, fijos, prestamos y saldo estimado en una sola vista.' : 'Proyección de aportes e intereses compuestos a lo largo del tiempo.'}</Text>
        </Space>
      </header>

      {activeSection === 'balance' ? <>
      {error && <Alert className="app-alert" type="error" title={error} showIcon />}
      <Toolbar
        month={month}
        setMonth={setMonth}
        category={category}
        setCategory={setCategory}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        status={status}
        setStatus={setStatus}
      />

      <Row gutter={[12, 12]} className="stats">
        <Col xs={24} sm={12} lg={4}>
          <SalaryStatTile month={month} config={data?.config} summary={data?.summary} onSaved={load} />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <FoodStatTile month={month} config={data?.config} summary={data?.summary} onSaved={load} />
        </Col>
        <Col xs={24} sm={12} lg={4}><StatTile icon={<CreditCardOutlined />} label="Tarjeta" value={data?.summary?.currentCreditExpenses || 0} /></Col>
        <Col xs={24} sm={12} lg={4}>
          <StatTile
            icon={<CheckCircleOutlined />}
            label="Pagado"
            value={data?.summary?.paidTotal || 0}
            hint={`Tarjeta: ${money.format(data?.summary?.paidCardStatementExpenses || 0)}`}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatTile
            icon={<CreditCardOutlined />}
            label="Pendiente"
            value={data?.summary?.pendingTotal || 0}
            hint={`Sin alquiler: ${money.format(data?.summary?.pendingTotalWithoutRent || 0)}`}
          />
        </Col>
        <Col xs={24} sm={24} lg={4}><StatTile icon={<WalletOutlined />} label="Saldo estimado" value={data?.summary?.estimatedBalance || 0} /></Col>
      </Row>

      <CategorySummary
        open={showCategorySummary}
        onToggle={() => setShowCategorySummary((value) => !value)}
        totals={data?.summary?.categoryTotals}
      />

      <EntryModal
        open={entryModalOpen}
        kind={entryKind}
        mode={entryMode}
        month={month}
        config={data?.config}
        editingExpense={editingExpense}
        editingLoan={editingLoan}
        onKindChange={setEntryKind}
        onClose={closeEntryModal}
        onSaved={saveEntryModal}
      />

      <Row gutter={[16, 16]} align="top">
        <Col xs={24}>
          <Space orientation="vertical" size={18} className="content-zone">
            <section>
              <Flex justify="space-between" align="center" className="section-title">
                <Space align="center">
                  <Title level={3}>Gastos</Title>
                  <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={openCreate} />
                </Space>
                <Text type="secondary">{filteredExpenses.length} items</Text>
              </Flex>
              {filteredExpenses.length ? (
                <Row gutter={[14, 14]}>
                  {filteredExpenses.map((expense) => (
                    <Col xs={24} md={12} xl={6} key={itemId(expense)}>
                      <ExpenseCard expense={expense} reload={load} onEdit={openEditExpense} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin gastos para estos filtros" />
              )}
            </section>

            <section>
              <Flex justify="space-between" align="center" className="section-title">
                <Title level={3}>Prestamos activos este mes</Title>
                <Text type="secondary">{data?.loans?.length || 0} items</Text>
              </Flex>
              {data?.loans?.length ? (
                <Row gutter={[14, 14]}>
                  {data.loans.map((loan) => (
                    <Col xs={24} md={12} xl={8} key={itemId(loan)}>
                      <LoanCard loan={loan} month={month} reload={load} onEdit={openEditLoan} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin prestamos activos este mes" />
              )}
            </section>
          </Space>
        </Col>
      </Row>
      </> : <SavingsSimulator />}
    </main>
  )
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgLayout: '#f4f6f8',
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Card: { headerFontSize: 16 },
          Form: { itemMarginBottom: 14 },
        },
      }}
    >
      <AppContent />
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
