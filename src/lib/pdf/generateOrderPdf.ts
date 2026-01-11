import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'
type UnknownRecord = Record<string, unknown>

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d =
    typeof value === 'number'
      ? new Date(value)
      : value?.toDate
        ? value.toDate()
        : new Date(value)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

function brl(v: number): string {
  const fixed = (Number.isFinite(v) ? v : 0).toFixed(2)
  const [i, dec] = fixed.split('.')
  const withThousands = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${withThousands},${dec}`
}

function getItemLabel(item: unknown): string {
  if (!isRecord(item)) return '—'

  const ps = item.productSnapshot
  if (isRecord(ps)) {
    const sku = typeof ps.sku === 'string' ? ps.sku : ''
    const name = typeof ps.name === 'string' ? ps.name : ''
    if (sku && name) return `${sku} - ${name}`
    if (sku) return sku
    if (name) return name
  }

  const sku2 = typeof item.sku === 'string' ? item.sku : ''
  const name2 = typeof item.name === 'string' ? item.name : ''
  if (sku2 && name2) return `${sku2} - ${name2}`
  if (sku2) return sku2
  if (name2) return name2

  const pid = typeof item.productId === 'string' ? item.productId : ''
  return pid || '—'
}

function getItemQty(item: unknown): number {
  if (!isRecord(item)) return 0
  const q1 = item.qty
  if (typeof q1 === 'number') return q1
  const q2 = item.quantity
  if (typeof q2 === 'number') return q2
  return 0
}

function getItemUnitPrice(item: unknown): number {
  if (!isRecord(item)) return 0
  const p1 = item.unitPrice
  if (typeof p1 === 'number') return p1
  const p2 = item.price
  if (typeof p2 === 'number') return p2
  return 0
}

function getCustomerField(order: any, key: string): string {
  const c = order?.customer
  if (!c || typeof c !== 'object') return ''
  const v = c[key]
  return typeof v === 'string' ? v : ''
}

function getOrderNumber(order: any): string {
  const n1 = typeof order?.orderNumber === 'string' ? order.orderNumber : ''
  const n2 = typeof order?.number === 'string' ? order.number : ''
  return n1 || n2 || ''
}

function inferKind(order: any): PdfKind {
  const st = typeof order?.status === 'string' ? order.status : ''
  return st === 'orcamento' ? 'ORCAMENTO' : 'PEDIDO'
}

/**
 * Mantém compatibilidade total:
 * - Pode ser chamado com 1 argumento (como hoje no page.tsx)
 * - Pode ser chamado com 2 argumentos se quiser forçar ORCAMENTO/PEDIDO
 */
export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K: PdfKind = kind ?? inferKind(order)

  // A4
  const A4_W = 595.28
  const A4_H = 841.89
  const M = 36

  // cores Sagrado
  const cBrand = rgb(244 / 255, 67 / 255, 157 / 255) // #F4439D
  const cText = rgb(17 / 255, 24 / 255, 39 / 255) // #111827
  const cMuted = rgb(75 / 255, 85 / 255, 99 / 255) // #4B5563
  const cBorder = rgb(229 / 255, 231 / 255, 235 / 255) // #E5E7EB
  const cSoft = rgb(1, 0.968, 0.984) // ~ #FFF7FB

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([A4_W, A4_H])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const drawLine = (y: number) => {
    page.drawLine({
      start: { x: M, y },
      end: { x: A4_W - M, y },
      thickness: 1,
      color: cBorder,
    })
  }

  const ensureSpace = (y: number, needed: number) => {
    if (y - needed <= M + 40) {
      page = pdfDoc.addPage([A4_W, A4_H])
      return A4_H - M
    }
    return y
  }

  const orderNumber = getOrderNumber(order)
  const createdAt = formatDatePtBR((order as any)?.createdAt)

  // ===== Header =====
  page.drawRectangle({ x: 0, y: A4_H - 110, width: A4_W, height: 110, color: cSoft })

  page.drawText('SAGRADO', { x: M, y: A4_H - 60, size: 26, font: fontB, color: cBrand })

  const docTitle = K === 'PEDIDO' ? 'PEDIDO' : 'ORÇAMENTO'
  page.drawText(`${docTitle} Nº ${orderNumber || '—'}`, {
    x: M,
    y: A4_H - 86,
    size: 12,
    font: fontB,
    color: cText,
  })

  page.drawText(`Data: ${createdAt}`, {
    x: A4_W - M - 150,
    y: A4_H - 86,
    size: 10,
    font,
    color: cMuted,
  })

  let y = A4_H - 130

  // ===== Faturante (CDA) no cabeçalho =====
  page.drawText('Faturante:', { x: M, y, size: 10, font: fontB, color: cText })
  y -= 14

  const faturanteLines = [
    'CDA Foods',
    'CNPJ: 00.874.798/0001-09',
    'Av. Liberdade, 500 – CEP 55014-580',
    'Tel: (81) 3723-8881',
    'administrativo@cdafoods.com.br',
  ]

  faturanteLines.forEach((line) => {
    page.drawText(line, { x: M, y, size: 9, font, color: cMuted })
    y -= 12
  })

  y -= 6
  drawLine(y)
  y -= 16

  // ===== Cliente =====
  page.drawText('Cliente:', { x: M, y, size: 10, font: fontB, color: cText })
  y -= 14

  const cName = getCustomerField(order as any, 'name')
  const cDoc = getCustomerField(order as any, 'document')
  const cPhone = getCustomerField(order as any, 'phone') || getCustomerField(order as any, 'whatsapp')
  const cEmail = getCustomerField(order as any, 'email')
  const cAddr = getCustomerField(order as any, 'address')
  const cCity = getCustomerField(order as any, 'city')
  const cState = getCustomerField(order as any, 'state')

  const clienteLines = [
    cName || '—',
    cDoc ? `Documento: ${cDoc}` : '',
    cPhone ? `Contato: ${cPhone}` : '',
    cEmail ? `E-mail: ${cEmail}` : '',
    cAddr || '',
    cCity || cState ? `${cCity}${cCity && cState ? ' - ' : ''}${cState}` : '',
  ].filter(Boolean)

  clienteLines.forEach((line) => {
    page.drawText(String(line), { x: M, y, size: 9, font, color: cMuted })
    y -= 12
  })

  y -= 6
  drawLine(y)
  y -= 18

  // ===== Tabela de itens =====
  page.drawText('Itens', { x: M, y, size: 12, font: fontB, color: cText })
  y -= 14

  const colProduto = M
  const colQtd = M + 300
  const colUnit = M + 350
  const colSub = M + 440

  const drawTableHeader = () => {
    page.drawText('Produto', { x: colProduto, y, size: 9, font: fontB, color: cText })
    page.drawText('Qtd', { x: colQtd, y, size: 9, font: fontB, color: cText })
    page.drawText('Unit.', { x: colUnit, y, size: 9, font: fontB, color: cText })
    page.drawText('Subtotal', { x: colSub, y, size: 9, font: fontB, color: cText })
  }

  drawTableHeader()
  y -= 8
  drawLine(y)
  y -= 12

  const items: unknown[] = Array.isArray((order as any)?.items) ? ((order as any).items as unknown[]) : []
  let computedTotal = 0

  for (const it of items) {
    y = ensureSpace(y, 32)

    const label = getItemLabel(it)
    const qty = getItemQty(it)
    const unit = getItemUnitPrice(it)
    const sub = qty * unit
    computedTotal += sub

    page.drawText(label, {
      x: colProduto,
      y,
      size: 9,
      font,
      color: cText,
      maxWidth: 280,
    })

    page.drawText(String(qty), { x: colQtd, y, size: 9, font, color: cText })
    page.drawText(brl(unit), { x: colUnit, y, size: 9, font, color: cText })
    page.drawText(brl(sub), { x: colSub, y, size: 9, font, color: cText })

    y -= 14
    page.drawLine({
      start: { x: M, y },
      end: { x: A4_W - M, y },
      thickness: 0.5,
      color: cBorder,
    })
    y -= 10

    // Se caiu numa página nova, redesenha cabeçalho da tabela
    if (y > A4_H - M - 60) {
      // nada
    }
  }

  y = ensureSpace(y, 80)

  // ===== Resumo =====
  drawLine(y)
  y -= 18

  const total =
    typeof (order as any)?.total === 'number' && Number.isFinite((order as any).total)
      ? (order as any).total
      : computedTotal

  page.drawText('Valor total:', { x: colUnit, y, size: 12, font: fontB, color: cText })
  page.drawText(brl(total), { x: colSub, y, size: 14, font: fontB, color: cBrand })

  // ===== Salva e baixa (igual antes) =====
  const pdfBytes = await pdfDoc.save()
  const safeBytes = new Uint8Array(pdfBytes)
  const blob = new Blob([safeBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url

  const prefix = K === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = orderNumber || ''
  const fileNumber =
    raw.startsWith('PED-') || raw.startsWith('ORC-') ? raw : raw ? `${prefix}-${raw}` : `${prefix}`

  a.download = `${K}_${fileNumber}.pdf`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}
