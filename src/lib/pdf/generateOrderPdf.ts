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
  
  // Colors
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  
  // Margins
  const margin = 50
  const contentWidth = width - margin * 2
  
  let y = height - margin
  
  // Header
  page.drawText('SAGRADO', {
    x: margin,
    y: y,
    size: 24,
    font: helveticaBold,
    color: black,
  })
  
  page.drawText(`Pedido: ${order.orderNumber}`, {
    x: width - margin - 150,
    y: y,
    size: 12,
    font: helveticaFont,
    color: gray,
  })
  
  y -= 30
  
  const orderDate = (typeof (order as any).createdAt === 'number')
    ? new Date((order as any).createdAt)
    : ((order as any).createdAt?.toDate ? (order as any).createdAt.toDate() : new Date())
  page.drawText(`Data: ${format(orderDate, 'dd/MM/yyyy', { locale: ptBR })}`, {
    x: width - margin - 150,
    y: y,
    size: 12,
    font: helveticaFont,
    color: gray,
  })
  
  y -= 40
  
  // Customer Section
  page.drawText('Cliente:', {
    x: margin,
    y: y,
    size: 14,
    font: helveticaBold,
    color: black,
  })
  
  y -= 20
  
  const customerLines = []
  customerLines.push(`Nome: ${order.customerSnapshot.name}`)
  if (order.customerSnapshot.doc) {
    customerLines.push(`CPF/CNPJ: ${order.customerSnapshot.doc}`)
  }
  customerLines.push(`Telefone: ${order.customerSnapshot.phone}`)
  if (order.customerSnapshot.email) {
    customerLines.push(`Email: ${order.customerSnapshot.email}`)
  }
  if (order.customerSnapshot.address) {
    customerLines.push(`Endereço: ${order.customerSnapshot.address}`)
  }
  
  customerLines.forEach(line => {
    page.drawText(line, {
      x: margin,
      y: y,
      size: 11,
      font: helveticaFont,
      color: gray,
    })
    y -= 15
  })
  
  y -= 20
  
  // Items Table Header
  const tableTopY = y
  const colWidths = [80, 200, 60, 80, 80]
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], 
                margin + colWidths[0] + colWidths[1] + colWidths[2], 
                margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]]
  
  // Table header background
  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: lightGray,
  })
  
  const headers = ['SKU', 'Produto', 'Qtd', 'Preço', 'Total']
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: colX[i] + 5,
      y: y - 15,
      size: 10,
      font: helveticaBold,
      color: black,
    })
  })
  
  y -= 25
  
  // Items
  order.items.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: contentWidth,
        height: 15,
        color: rgb(0.97, 0.97, 0.97),
      })
    }
    
    page.drawText(item.productSnapshot.sku, {
      x: colX[0] + 5,
      y: y - 10,
      size: 9,
      font: helveticaFont,
      color: black,
    })
    
    page.drawText(item.productSnapshot.name, {
      x: colX[1] + 5,
      y: y - 10,
      size: 9,
      font: helveticaFont,
      color: black,
    })
    
    page.drawText(String(item.qty), {
      x: colX[2] + 5,
      y: y - 10,
      size: 9,
      font: helveticaFont,
      color: black,
    })
    
    page.drawText(`R$ ${item.unitPrice.toFixed(2)}`, {
      x: colX[3] + 5,
      y: y - 10,
      size: 9,
      font: helveticaFont,
      color: black,
    })
    
    page.drawText(`R$ ${item.total.toFixed(2)}`, {
      x: colX[4] + 5,
      y: y - 10,
      size: 9,
      font: helveticaFont,
      color: black,
    })
    
    y -= 15
  })
  
  // Table bottom line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: gray,
  })
  
  y -= 20
  
  // Totals section
  const totalsX = width - margin - 150
  
  const totals = [
    { label: 'Subtotal:', value: `R$ ${order.totals.subtotal.toFixed(2)}` },
    { label: 'Desconto:', value: `R$ ${order.totals.discount.toFixed(2)}` },
    { label: 'Frete:', value: `R$ ${order.totals.freight.toFixed(2)}` },
    { label: 'Total:', value: `R$ ${order.totals.total.toFixed(2)}`, bold: true },
  ]
  
  totals.forEach((total, i) => {
    if (total.bold) {
      // Line above total
      page.drawLine({
        start: { x: totalsX, y: y + 5 },
        end: { x: width - margin, y: y + 5 },
        thickness: 1,
        color: black,
      })
    }
    
    page.drawText(total.label, {
      x: totalsX,
      y: y,
      size: total.bold ? 12 : 11,
      font: total.bold ? helveticaBold : helveticaFont,
      color: black,
    })
    
    page.drawText(total.value, {
      x: width - margin - 60,
      y: y,
      size: total.bold ? 12 : 11,
      font: total.bold ? helveticaBold : helveticaFont,
      color: black,
    })
    
    y -= total.bold ? 20 : 15
  })
  
  // Notes section
  if (order.notes && order.notes.trim()) {
    y -= 20
    
    page.drawText('Observações:', {
      x: margin,
      y: y,
      size: 12,
      font: helveticaBold,
      color: black,
    })
    
    y -= 15
    
    const notesLines = order.notes.split('\n')
    notesLines.forEach(line => {
      page.drawText(line, {
        x: margin,
        y: y,
        size: 10,
        font: helveticaFont,
        color: gray,
      })
      y -= 12
    })
  }
  
  // Footer
  y = margin + 20
  page.drawText('SAGRADO - Sistema de Pedidos', {
    x: margin,
    y: y,
    size: 9,
    font: helveticaFont,
    color: gray,
  })
  
  return await pdfDoc.save()
}

export function downloadOrderPdf(order: Order, pdfBytes: Uint8Array) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Pedido_Sagrado_${order.orderNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}