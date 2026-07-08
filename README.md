# Gastos del Mes

Starter web para administrar gastos por mes, sueldo, alimentos, gastos fijos y préstamos con cuotas.

## Stack

- React + Vite
- API Node serverless para Vercel
- MongoDB con Mongoose

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

Para probar API serverless local conviene usar:

```bash
npm i -g vercel
vercel dev
```

## Deploy en Vercel

1. Subir repo a GitHub.
2. Importar en Vercel.
3. Configurar variable `MONGODB_URI`.
4. Deploy.

## Modelo funcional

- Configuración mensual: sueldo, porcentaje alimentos, notas.
- Gastos comunes: categoría, monto, fecha, estado pago, fijo mensual, medio de pago.
- Préstamos: capital pedido, total a devolver, fecha inicio, cantidad de cuotas, cuota promedio, pagos por mes.
- Dashboard por mes: ingresos, alimentos, gastos pagados/pendientes, préstamos, saldo estimado.
