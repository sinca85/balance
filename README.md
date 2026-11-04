# Gastos del Mes

Starter web para administrar gastos por mes, sueldo, alimentos, gastos fijos y préstamos con cuotas.

## Stack

- React + Vite
- API Node serverless para Vercel
- MongoDB con Mongoose
- Vercel Blob para guardar la simulación de ahorro como JSON persistente

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
4. Crear un Blob Store privado en Vercel y vincularlo al proyecto. Esto agrega `BLOB_READ_WRITE_TOKEN`.
5. Deploy.

La simulación de ahorro usa el endpoint `/api/savings`. En Vercel se guarda en el Blob Store como un JSON privado, por lo que queda disponible desde cualquier dispositivo. En desarrollo local, si no existe `BLOB_READ_WRITE_TOKEN`, se usa `.data/savings-simulation.json`.

## Modelo funcional

- Configuración mensual: sueldo, porcentaje alimentos, notas.
- Gastos comunes: categoría, monto, fecha, estado pago, fijo mensual, medio de pago.
- Préstamos: capital pedido, total a devolver, fecha inicio, cantidad de cuotas, cuota promedio, pagos por mes.
- Dashboard por mes: ingresos, alimentos, gastos pagados/pendientes, préstamos, saldo estimado.
