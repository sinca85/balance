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
      foodPercent: config?.foodPercent ?? 30,
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
        isPaid: Boolean(editingExpense.isPaid),
        isFixed: Boolean(editingExpense.isFixed),
        notes: editingExpense.notes || '',
      })
      return
    }
    form.setFieldsValue({ date: dayjs(`${month}-01`), category: 'general', paymentMethod: 'efectivo', creditCard: undefined, installments: 1, isPaid: false, isFixed: false })
  }, [month, form, editingExpense])

  async function submit(values) {
    const payload = {
      ...values,
      amount: Number(values.amount),
      date: values.date.format('YYYY-MM-DD'),
      month: editingExpense?.month || month,
      type: values.isFixed ? 'fixed' : 'variable',
      creditCard: values.paymentMethod === 'credito' ? values.creditCard || '' : '',
      installments: values.paymentMethod === 'credito' ? Number(values.installments || 1) : 1,
    }
    await api(editingExpense ? `expenses/${editingExpense._id}` : 'expenses', {
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

  async function toggle() {
    await api(`expenses/${expense._id}`, { method: 'PATCH', body: JSON.stringify({ isPaid: !expense.isPaid }) })
    reload()
  }

  async function remove() {
    await api(`expenses/${expense._id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <Card
      className={expense.isPaid ? 'item-card item-card-paid' : 'item-card'}
      variant="borderless"
      actions={[
        <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(expense)}>
          Editar
        </Button>,
        <Button type="text" icon={<CheckCircleOutlined />} onClick={toggle}>
          {expense.isPaid ? 'Marcar pendiente' : 'Marcar pago'}
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
        <Tag color={expense.isPaid ? 'green' : 'orange'}>{expense.isPaid ? 'pago' : 'pendiente'}</Tag>
      </Space>
      {expense.notes && <Text className="notes">{expense.notes}</Text>}
    </Card>
  )
}

function LoanCard({ loan, month, reload, onEdit }) {
  async function toggle() {
    await api('loan-payment', { method: 'POST', body: JSON.stringify({ loanId: loan._id, month, amount: loan.amountThisMonth, isPaid: !loan.isPaid }) })
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

  const filteredExpenses = useMemo(() => (data?.expenses || []).filter((e) => {
    const payment = normalizeLegacyPayment(e)
    if (category !== 'all' && e.category !== category) return false
    if (paymentMethod.includes(':')) {
      const [method, card] = paymentMethod.split(':')
      if (payment.paymentMethod !== method || payment.creditCard !== card) return false
    } else if (paymentMethod !== 'all' && payment.paymentMethod !== paymentMethod) {
      return false
    }
    if (status === 'paid' && !e.isPaid) return false
    if (status === 'pending' && e.isPaid) return false
    return true
  }), [data, category, paymentMethod, status])

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
        <Space orientation="vertical" size={6}>
          <Space align="center">
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
          </Space>
          <Title>Balance</Title>
          <Text type="secondary">Sueldo, alimentos, gastos, fijos, prestamos y saldo estimado en una sola vista.</Text>
        </Space>
      </header>

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
        <Col xs={24} sm={12} lg={4}><StatTile icon={<DollarOutlined />} label="Sueldo" value={data?.summary?.salary || 0} /></Col>
        <Col xs={24} sm={12} lg={5}><StatTile icon={<WalletOutlined />} label={`Alimentos (${data?.summary?.foodPercent ?? 30}%)`} value={data?.summary?.foodAmount || 0} /></Col>
        <Col xs={24} sm={12} lg={5}><StatTile icon={<CheckCircleOutlined />} label="Pagado" value={data?.summary?.paidTotal || 0} /></Col>
        <Col xs={24} sm={12} lg={5}>
          <StatTile
            icon={<CreditCardOutlined />}
            label="Pendiente"
            value={data?.summary?.pendingTotal || 0}
            hint={`Sin alquiler: ${money.format(data?.summary?.pendingTotalWithoutRent || 0)}`}
          />
        </Col>
        <Col xs={24} sm={24} lg={5}><StatTile icon={<WalletOutlined />} label="Saldo estimado" value={data?.summary?.estimatedBalance || 0} /></Col>
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
                    <Col xs={24} md={12} xl={8} key={expense._id}>
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
                    <Col xs={24} md={12} xl={8} key={loan._id}>
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
