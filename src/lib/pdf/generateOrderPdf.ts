import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Order } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function generateOrderPdf(order: Order): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size

  const { width, height } = page.getSize()
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 50
  let y = height - margin

  // Header
  page.drawText('Sagrado - Pedido', {
    x: margin,
    y,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })

  y -= 30

  // Order info
  page.drawText(`Pedido: ${order.orderNumber}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 20

  page.drawText(
    `Data: ${format(new Date(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    {
      x: margin,
      y,
      size: 12,
      font: helveticaFont,
    }
  )

  y -= 20

  page.drawText(`Status: ${order.status}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 30

  // Customer info
  page.drawText('Cliente', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
  })

  y -= 20

  page.drawText(`Nome: ${order.customerSnapshot?.name ?? ''}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Documento: ${order.customerSnapshot?.doc ?? ''}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Telefone: ${order.customerSnapshot?.phone ?? ''}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Email: ${order.customerSnapshot?.email ?? ''}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Endereço: ${order.customerSnapshot?.address ?? ''}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 30

  // Items table header
  page.drawText('Itens', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
  })

  y -= 20

  const colSku = margin
  const colName = margin + 80
  const colQty = width - margin - 170
  const colUnit = width - margin - 120
  const colPrice = width - margin - 70
  const colTotal = width - margin

  page.drawText('SKU', { x: colSku, y, size: 10, font: helveticaBold })
  page.drawText('Produto', { x: colName, y, size: 10, font: helveticaBold })
  page.drawText('Qtd', { x: colQty, y, size: 10, font: helveticaBold })
  page.drawText('Und', { x: colUnit, y, size: 10, font: helveticaBold })
  page.drawText('Preço', { x: colPrice, y, size: 10, font: helveticaBold })
  page.drawText('Total', { x: colTotal - 30, y, size: 10, font: helveticaBold })

  y -= 12

  // Items
  for (const item of order.items) {
    const sku = item.productSnapshot?.sku ?? ''
    const name = item.productSnapshot?.name ?? ''
    const qty = item.qty ?? 0
    const unit = item.productSnapshot?.unit ?? ''
    const unitPrice = item.unitPrice ?? 0
    const total = item.total ?? qty * unitPrice

    page.drawText(sku, { x: colSku, y, size: 10, font: helveticaFont })
    page.drawText(name, {
      x: colName,
      y,
      size: 10,
      font: helveticaFont,
      maxWidth: colQty - colName - 10,
    })
    page.drawText(String(qty), { x: colQty, y, size: 10, font: helveticaFont })
    page.drawText(unit, { x: colUnit, y, size: 10, font: helveticaFont })
    page.drawText(unitPrice.toFixed(2), { x: colPrice, y, size: 10, font: helveticaFont })
    page.drawText(total.toFixed(2), { x: colTotal - 55, y, size: 10, font: helveticaFont })

    y -= 14
    if (y < margin + 100) break // simples pra não estourar página
  }

  y -= 20

  // Totals
  page.drawText(`Subtotal: ${(order.totals?.subtotal ?? 0).toFixed(2)}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Desconto: ${(order.totals?.discount ?? 0).toFixed(2)}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Frete: ${(order.totals?.freight ?? 0).toFixed(2)}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
  })

  y -= 18

  page.drawText(`Total: ${(order.totals?.total ?? 0).toFixed(2)}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
  })

  return await pdfDoc.save()
}

export function downloadOrderPdf(order: Order, pdfBytes: Uint8Array) {
  // ✅ FIX: normaliza para evitar conflito de tipagem (ArrayBufferLike/SharedArrayBuffer) no build
  const bytes = new Uint8Array(pdfBytes)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Pedido_Sagrado_${order.orderNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
