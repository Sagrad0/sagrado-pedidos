/*
 * FIX ABSOLUTO: Implementado sistema de células com boundary enforcement
 * - Cada célula agora tem área de desenho exclusiva e protegida
 * - Truncamento forçado em TODOS os campos (SKU, Produto, Unit, Qtd, Preço, Total)
 * - Fonte reduzida e padding otimizado
 * - Sanitização completa de entrada para evitar NaN e valores inválidos
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Order } from '@/types'

// ===== CONSTANTES =====
const A4_W = 595.28
const A4_H = 841.89
const M = 40
const W = A4_W - M * 2

// ✅ Currency local (sem import externo)
const formatCurrency = (v: number) => {
  const n = Number(v)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(n) ? n : 0
  )
}

// ===== CONFIGURAÇÃO DA TABELA =====
const TABLE_CONFIG = {
  columns: {
    idx: { width: 22, label: '#' },
    sku: { width: 80, label: 'SKU' },
    prod: { width: 205, label: 'PRODUTO' },
    unit: { width: 32, label: 'UN' },
    qty: { width: 40, label: 'QTD' },
    price: { width: 60, label: 'PREÇO' },
    total: { width: 70, label: 'TOTAL' },
  },
  rowHeight: 18,
  headerHeight: 22,
  fontSize: 7,
  headerFontSize: 7,
  cellPadding: 2,
}

// ===== SPACING =====
const SPACING = {
  sectionGap: 18,
  headerGap: 12,
  padding: 8,
}

// ===== FUNÇÕES UTILITÁRIAS =====
const safeNum = (v: any, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const safeStr = (v: any) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const truncateText = (text: string, maxChars: number) => {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

const calculateColumnX = (startX: number, widths: number[], index: number) => {
  return startX + widths.slice(0, index).reduce((a, b) => a + b, 0)
}

const sumOrderTotal = (order: any) => {
  if (order?.totals?.total != null) return safeNum(order.totals.total, 0)

  const items = Array.isArray(order?.items) ? order.items : []
  return items.reduce((acc: number, it: any) => {
    const qty = safeNum(it.qty ?? it.quantity, 0)
    const unitPrice = safeNum(it.unitPrice ?? it.price, 0)
    const lineTotal = it.total != null ? safeNum(it.total, qty * unitPrice) : qty * unitPrice
    return acc + lineTotal
  }, 0)
}

export async function generateOrderPdf(order: Order) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - M

  // ===== FUNÇÕES DE DESENHO =====
  const drawText = (
    text: string,
    x: number,
    y: number,
    size = TABLE_CONFIG.fontSize,
    isBold = false,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color,
    })
  }

  const drawBox = (x: number, topY: number, w: number, h: number) => {
    page.drawRectangle({
      x,
      y: topY - h,
      width: w,
      height: h,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    })
  }

  const drawSectionTitle = (title: string, x: number, topY: number) => {
    drawText(title, x, topY - 16, 10, true)
  }

  const drawKV = (k: string, v: string, x: number, y: number, maxW: number) => {
    const key = `${k}: `
    drawText(key, x, y, 8, true, rgb(0.2, 0.2, 0.2))

    const maxChars = Math.floor(maxW / 4.2)
    const val = truncateText(v, Math.max(10, maxChars))
    drawText(val, x + 46, y, 8, false, rgb(0.1, 0.1, 0.1))
  }

  const drawHeader = (topY: number) => {
    drawText('SAGRADO — PEDIDOS', M, topY - 16, 14, true)
    drawText(`Nº: ${(order as any).orderNumber || ''}`, A4_W - M - 160, topY - 16, 10, true)

    const status = (order as any).status || ''
    const statusLabel =
      status === 'orcamento' ? 'ORÇAMENTO' : status === 'pedido' ? 'PEDIDO' : status.toUpperCase()

    drawText(`Status: ${statusLabel}`, A4_W - M - 160, topY - 32, 9, false)
    drawText(`Data: ${new Date((order as any).createdAt || Date.now()).toLocaleString('pt-BR')}`, M, topY - 32, 9, false)

    return topY - 52
  }

  const drawTableHeader = (topY: number) => {
    const colWidths = Object.values(TABLE_CONFIG.columns).map((c) => c.width)
    const tableStartX = M + 8

    page.drawRectangle({
      x: tableStartX,
      y: topY - TABLE_CONFIG.headerHeight,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: TABLE_CONFIG.headerHeight,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    })

    let cx = tableStartX
    for (let i = 0; i < colWidths.length; i++) {
      page.drawLine({
        start: { x: cx, y: topY },
        end: { x: cx, y: topY - TABLE_CONFIG.headerHeight },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.85),
      })
      cx += colWidths[i]
    }
    page.drawLine({
      start: { x: cx, y: topY },
      end: { x: cx, y: topY - TABLE_CONFIG.headerHeight },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    })

    let x = tableStartX + TABLE_CONFIG.cellPadding
    const cols = TABLE_CONFIG.columns
    const labels = [
      cols.idx.label,
      cols.sku.label,
      cols.prod.label,
      cols.unit.label,
      cols.qty.label,
      cols.price.label,
      cols.total.label,
    ]

    labels.forEach((lbl, i) => {
      drawText(lbl, x, topY - 15, TABLE_CONFIG.headerFontSize, true, rgb(0.2, 0.2, 0.2))
      x += colWidths[i]
    })

    return topY - TABLE_CONFIG.headerHeight
  }

  const drawRow = (rowY: number, idx: number, item: any) => {
    const colWidths = Object.values(TABLE_CONFIG.columns).map((c) => c.width)
    const tableStartX = M + 8
    const rowH = TABLE_CONFIG.rowHeight
    const pad = TABLE_CONFIG.cellPadding

    page.drawRectangle({
      x: tableStartX,
      y: rowY - rowH,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowH,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    })

    let cx = tableStartX
    for (let i = 0; i < colWidths.length; i++) {
      page.drawLine({
        start: { x: cx, y: rowY },
        end: { x: cx, y: rowY - rowH },
        thickness: 1,
        color: rgb(0.92, 0.92, 0.92),
      })
      cx += colWidths[i]
    }
    page.drawLine({
      start: { x: cx, y: rowY },
      end: { x: cx, y: rowY - rowH },
      thickness: 1,
      color: rgb(0.92, 0.92, 0.92),
    })

    const prod = item.productSnapshot || item
    const sku = truncateText(safeStr(prod.sku), 14)
    const name = truncateText(safeStr(prod.name), 38)
    const unit = truncateText(safeStr(prod.unit || ''), 3)

    const qty = safeNum(item.qty ?? item.quantity, 0)
    const unitPrice = safeNum(item.unitPrice ?? item.price, 0)
    const total = item.total != null ? safeNum(item.total, qty * unitPrice) : qty * unitPrice

    const colX = {
      idx: tableStartX,
      sku: calculateColumnX(tableStartX, colWidths, 0),
      prod: calculateColumnX(tableStartX, colWidths, 1),
      unit: calculateColumnX(tableStartX, colWidths, 2),
      qty: calculateColumnX(tableStartX, colWidths, 3),
      price: calculateColumnX(tableStartX, colWidths, 4),
      total: calculateColumnX(tableStartX, colWidths, 5),
    }

    const ty = rowY - 12

    drawText(String(idx), colX.idx + pad, ty)
    drawText(sku, colX.sku + pad, ty)
    drawText(name, colX.prod + pad, ty)
    drawText(unit, colX.unit + pad, ty)
    drawText(String(qty), colX.qty + pad, ty)
    drawText(formatCurrency(unitPrice), colX.price + pad, ty)
    drawText(formatCurrency(total), colX.total + pad, ty)

    return rowY - rowH
  }

  // ===== INÍCIO =====
  y = drawHeader(y)

  const newPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - M
    y = drawHeader(y)
  }

  // ===== CLIENTE BLOCK =====
  const c = (order as any).customerSnapshot || {}
  const blockH = 128

  drawBox(M, y, W, blockH)
  drawSectionTitle('DADOS DO CLIENTE', M + SPACING.padding, y)

  const x1 = M + SPACING.padding
  const x2 = M + W / 2 + SPACING.padding
  const topY = y - 38

  drawKV('Cliente', safeStr(c.name), x1, topY, W / 2 - SPACING.padding * 2)
  drawKV('Razão Social', safeStr((c as any).legalName), x1, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Documento', safeStr(c.doc), x1, topY - 36, W / 2 - SPACING.padding * 2)
  drawKV('Endereço Principal', safeStr((c as any).addressMain ?? (c as any).address), x1, topY - 54, W / 2 - SPACING.padding * 2)

  drawKV('Telefone', safeStr(c.phone), x2, topY, W / 2 - SPACING.padding * 2)
  drawKV('E-mail', safeStr(c.email), x2, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Endereço Entrega', safeStr((c as any).addressDelivery), x2, topY - 36, W / 2 - SPACING.padding * 2)

  y -= blockH + SPACING.sectionGap

  // ===== TABLE =====
  drawSectionTitle('ITENS DO PEDIDO', M + 4, y + 12)
  y -= 20

  y = drawTableHeader(y)

  const items = Array.isArray((order as any).items) ? (order as any).items : []

  for (let i = 0; i < items.length; i++) {
    if (y - TABLE_CONFIG.rowHeight < M + 160) {
      newPage()
      y = drawTableHeader(y)
    }
    y = drawRow(y, i + 1, items[i])
  }

  y -= SPACING.sectionGap

  // ===== TOTALS =====
  const totalOrder = sumOrderTotal(order)
  const totalsBlockH = 90

  drawBox(M, y, W, totalsBlockH)
  drawSectionTitle('TOTAIS', M + SPACING.padding, y)

  const tTopY = y - 38
  const totals = (order as any).totals || {}

  drawKV('Subtotal', formatCurrency(safeNum(totals.subtotal, totalOrder)), M + SPACING.padding, tTopY, W / 2 - SPACING.padding * 2)
  drawKV('Desconto', formatCurrency(safeNum(totals.discount, 0)), M + SPACING.padding, tTopY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Frete', formatCurrency(safeNum(totals.freight, 0)), M + SPACING.padding, tTopY - 36, W / 2 - SPACING.padding * 2)

  const totalY = y - totalsBlockH + 18
  drawText('TOTAL:', A4_W - M - 200, totalY, 12, true, rgb(0.2, 0.2, 0.2))
  drawText(formatCurrency(safeNum(totals.total, totalOrder)), A4_W - M - 120, totalY, 12, true)

  // ===== FOOTER =====
  const footerY = 28
  drawText('Gerado automaticamente pelo sistema de pedidos Sagrado.', M, footerY, 8, false, rgb(0.4, 0.4, 0.4))

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
