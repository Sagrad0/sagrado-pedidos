import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Order } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

function formatDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

export async function generateOrderPdf(order: Order) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 40
  let y = height - margin

  // Header
  page.drawText('SAGRADO - Pedido', {
    x: margin,
    y,
    size: 18,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 28

  page.drawText(`Pedido: ${order.orderNumber}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 16

  page.drawText(`Status: ${order.status}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 16

  page.drawText(`Criado em: ${formatDate(order.createdAt)}`, {
    x: margin,
    y,
    size: 12,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 22

  // Customer box
  page.drawRectangle({
    x: margin,
    y: y - 70,
    width: width - margin * 2,
    height: 70,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  })

  const customerName = order.customerSnapshot?.name || ''
  const customerDoc = order.customerSnapshot?.doc || ''
  const customerPhone = order.customerSnapshot?.phone || ''
  const customerEmail = order.customerSnapshot?.email || ''
  const customerAddress = order.customerSnapshot?.address || ''

  page.drawText('Cliente', {
    x: margin + 10,
    y: y - 18,
    size: 12,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`${customerName}`, {
    x: margin + 10,
    y: y - 35,
    size: 11,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Documento: ${customerDoc}`, {
    x: margin + 10,
    y: y - 50,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  page.drawText(`Telefone: ${customerPhone}`, {
    x: margin + 200,
    y: y - 50,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  page.drawText(`Email: ${customerEmail}`, {
    x: margin + 10,
    y: y - 64,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  page.drawText(`Endereço: ${customerAddress}`, {
    x: margin + 10,
    y: y - 78,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  y -= 95

  // Items header
  page.drawText('Itens do Pedido', {
    x: margin,
    y,
    size: 13,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 18

  // Table header
  const colX = {
    sku: margin,
    name: margin + 70,
    qty: width - margin - 170,
    unit: width - margin - 120,
    price: width - margin - 70,
    total: width - margin,
  }

  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: width - margin, y: y + 10 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })

  page.drawText('SKU', {
    x: colX.sku,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  page.drawText('Produto', {
    x: colX.name,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  page.drawText('Qtd', {
    x: colX.qty,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  page.drawText('Unit', {
    x: colX.unit,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  page.drawText('Preço', {
    x: colX.price,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  page.drawText('Total', {
    x: colX.total - 35,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0.25, 0.25, 0.25),
  })

  y -= 14

  page.drawLine({
    start: { x: margin, y: y + 6 },
    end: { x: width - margin, y: y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })

  y -= 6

  // Items rows
  const rowHeight = 16

  for (const item of order.items || []) {
    // quebra de página simples
    if (y < margin + 160) {
      // cria nova página
      const newPage = pdfDoc.addPage([595.28, 841.89])
      y = newPage.getSize().height - margin

      // header repetido
      newPage.drawText('SAGRADO - Pedido (continuação)', {
        x: margin,
        y,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      })

      y -= 24

      // reatribui page
      ;(page as any) = newPage

      // table header de novo
      ;(page as any).drawText('SKU', {
        x: colX.sku,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      ;(page as any).drawText('Produto', {
        x: colX.name,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      ;(page as any).drawText('Qtd', {
        x: colX.qty,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      ;(page as any).drawText('Unit', {
        x: colX.unit,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      ;(page as any).drawText('Preço', {
        x: colX.price,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      ;(page as any).drawText('Total', {
        x: colX.total - 35,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0.25, 0.25, 0.25),
      })

      y -= 20
    }

    const sku = item.productSnapshot?.sku || ''
    const name = item.productSnapshot?.name || ''
    const unit = item.productSnapshot?.unit || ''
    const qty = item.qty || 0
    const unitPrice = item.unitPrice || 0
    const total = item.total || qty * unitPrice

    page.drawText(sku, {
      x: colX.sku,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(name, {
      x: colX.name,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: colX.qty - colX.name - 10,
    })

    page.drawText(String(qty), {
      x: colX.qty,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(unit, {
      x: colX.unit,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(formatCurrency(unitPrice), {
      x: colX.price,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(formatCurrency(total), {
      x: colX.total - 55,
      y,
      size: 9,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    y -= rowHeight
  }

  y -= 10

  // Totals box
  const boxHeight = 90
  page.drawRectangle({
    x: width - margin - 230,
    y: y - boxHeight,
    width: 230,
    height: boxHeight,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  })

  const subtotal = order.totals?.subtotal || 0
  const discount = order.totals?.discount || 0
  const freight = order.totals?.freight || 0
  const total = order.totals?.total || subtotal - discount + freight

  const labelX = width - margin - 220
  const valueX = width - margin - 10

  let ty = y - 18
  page.drawText('Subtotal:', {
    x: labelX,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(formatCurrency(subtotal), {
    x: valueX - 70,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  ty -= 16
  page.drawText('Desconto:', {
    x: labelX,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(formatCurrency(discount), {
    x: valueX - 70,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  ty -= 16
  page.drawText('Frete:', {
    x: labelX,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(formatCurrency(freight), {
    x: valueX - 70,
    y: ty,
    size: 10,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  ty -= 18
  page.drawLine({
    start: { x: width - margin - 230, y: ty + 10 },
    end: { x: width - margin, y: ty + 10 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })

  page.drawText('Total:', {
    x: labelX,
    y: ty - 2,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText(formatCurrency(total), {
    x: valueX - 70,
    y: ty - 2,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= boxHeight + 20

  // Notes
  const notes = order.notes || ''
  if (notes) {
    page.drawText('Observações:', {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    })

    y -= 14

    page.drawText(notes, {
      x: margin,
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: width - margin * 2,
      lineHeight: 12,
    })

    y -= 40
  }

  // Footer
  y = margin + 20
  page.drawText('SAGRADO - Sistema de Pedidos', {
    x: margin,
    y: y,
    size: 9,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  })
  
  return await pdfDoc.save()
}

export function downloadOrderPdf(order: Order, pdfBytes: Uint8Array) {
  // pdf-lib pode retornar Uint8Array<ArrayBufferLike> (ex.: SharedArrayBuffer) e isso quebra a tipagem do Blob no build do Next.
  // Normaliza para Uint8Array<ArrayBuffer> copiando os bytes.
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
