import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

/**
 * PDF (layout tipo Mercos / modelo ARCO) + refinado:
 * - Barra de marca com logo (public/brand/sagrado-logo-negativo.png)
 * - Hierarquia de texto e espaçamento melhores
 * - Tabela com grid limpo, alinhamento e cabeçalho “com cara”
 * - Caixa de totais destacada
 *
 * Regras:
 * - Sem fotos de produtos
 * - Faturante (CDA Foods) no cabeçalho (dados completos)
 */
const FATURANTE = {
  razaoSocial: 'CDA FOODS LTDA',
  nomeFantasia: 'CDA Foods',
  cnpj: '00.000.000/0000-00',
  ie: '000000000',
  endereco: 'ENDEREÇO COMPLETO, Nº, BAIRRO, CEP',
  cidade: 'RECIFE',
  uf: 'PE',
  telefone: '(81) 00000-0000',
  email: 'contato@cdafoods.com.br',
}

// === BRAND ===
const BRAND = {
  // roxo padrão (estética Sagrado)
  purple: rgb(0x45 / 255, 0x00 / 255, 0x57 / 255), // #450057
  purpleDark: rgb(0x30 / 255, 0x00 / 255, 0x3d / 255),
  bgSoft: rgb(0.97, 0.97, 0.97),
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.45, 0.45, 0.45),
  border: rgb(0.16, 0.16, 0.16),
  tableHead: rgb(0.93, 0.93, 0.93),
  zebra: rgb(0.985, 0.985, 0.985),
  white: rgb(1, 1, 1),
}

const LOGO_PATH = '/brand/sagrado-logo-negativo.png'

const A4_W = 595.28
const A4_H = 841.89
const M = 28 // margem

function safeStr(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
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
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function n2(v: number): number {
  const n = Number.isFinite(v) ? v : 0
  return Math.round(n * 100) / 100
}

function inferKind(order: Order, kind?: PdfKind): PdfKind {
  if (kind) return kind
  if ((order as any).status === 'orcamento') return 'ORCAMENTO'
  return 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr((order as any).orderNumber).trim()
  if (!raw) return prefix
  if (raw.startsWith('PED-') || raw.startsWith('ORC-')) return raw
  return `${prefix}-${raw}`
}

// Fetch logo from /public
async function tryLoadLogoBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(LOGO_PATH, { cache: 'force-cache' })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
  } catch {
    return null
  }
}

export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K = inferKind(order, kind)

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([A4_W, A4_H])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W = A4_W - 2 * M

  // Try embed logo (PNG) – non-blocking
  let logoPng: any = null
  const logoBytes = await tryLoadLogoBytes()
  if (logoBytes) {
    try {
      logoPng = await pdfDoc.embedPng(logoBytes)
    } catch {
      logoPng = null
    }
  }

  const drawBox = (x: number, yTop: number, w: number, h: number, fill?: any, border = true) => {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      borderColor: border ? BRAND.border : undefined,
      borderWidth: border ? 1 : 0,
      color: fill,
    })
  }

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts?: {
      bold?: boolean
      size?: number
      color?: any
      maxWidth?: number
      align?: 'left' | 'right' | 'center'
    }
  ) => {
    const size = opts?.size ?? 9
    const f = opts?.bold ? fontB : font
    const color = opts?.color ?? BRAND.text
    const t = safeStr(text)

    if (opts?.align && opts.align !== 'left') {
      const w = f.widthOfTextAtSize(t, size)
      let xx = x
      if (opts.align === 'right') xx = x - w
      if (opts.align === 'center') xx = x - w / 2
      page.drawText(t, { x: xx, y, size, font: f, color, maxWidth: opts?.maxWidth })
      return
    }

    page.drawText(t, { x, y, size, font: f, color, maxWidth: opts?.maxWidth })
  }

  const drawSectionTitle = (title: string, x: number, yTop: number) => {
    // small label
    drawText(title, x, yTop - 12, { bold: true, size: 10, color: BRAND.purple })
  }

  const drawKV = (label: string, value: string, x: number, y: number, w: number) => {
    const L = `${label}:`
    drawText(L, x, y, { bold: true, size: 9, color: BRAND.text })
    const lw = fontB.widthOfTextAtSize(L, 9)
    drawText(value || '—', x + lw + 4, y, { size: 9, color: BRAND.text, maxWidth: w - lw - 4 })
  }

  const wrapText = (text: string, maxWidth: number, size: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''

    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      const wLen = font.widthOfTextAtSize(test, size)
      if (wLen <= maxWidth) line = test
      else {
        if (line) lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // ===== HEADER (Mercos-like refined) =====
  const drawHeader = (yTop: number): number => {
    // Brand bar
    const brandH = 44
    page.drawRectangle({ x: M, y: yTop - brandH, width: W, height: brandH, color: BRAND.purple })

    // Logo (left)
    const leftX = M + 12
    const brandMidY = yTop - brandH / 2

    if (logoPng) {
      // keep proportions, fit into 28px height
      const targetH = 26
      const scale = targetH / logoPng.height
      const imgW = logoPng.width * scale
      const imgH = logoPng.height * scale
      page.drawImage(logoPng, {
        x: leftX,
        y: brandMidY - imgH / 2,
        width: imgW,
        height: imgH,
      })
    } else {
      // fallback
      drawText('SAGRADO', leftX, brandMidY - 7, { bold: true, size: 14, color: BRAND.white })
    }

    // Center title
    const title = K === 'PEDIDO' ? 'PEDIDO' : 'ORÇAMENTO'
    drawText(title, M + W / 2, yTop - 18, { bold: true, size: 14, align: 'center', color: BRAND.white })

    // Document box under bar
    const h = 76
    const topBoxY = yTop - brandH - 10
    drawBox(M, topBoxY, W, h, BRAND.bgSoft)

    // Left: system meta
    drawText('Sistema de Pedidos', M + 12, topBoxY - 18, { size: 9, color: BRAND.muted })

    // Center: doc number/date (bigger)
    drawText(`Nº ${docNumber(order, K)}`, M + W / 2, topBoxY - 22, { bold: true, size: 12, align: 'center' })
    drawText(`Emissão: ${formatDatePtBR((order as any).createdAt)}`, M + W / 2, topBoxY - 40, {
      size: 9,
      align: 'center',
      color: BRAND.text,
    })

    // Right: faturante
    const rightX = M + W - 12
    drawText(FATURANTE.nomeFantasia, rightX, topBoxY - 18, { bold: true, size: 10, align: 'right' })
    drawText(FATURANTE.razaoSocial, rightX, topBoxY - 32, { size: 8, align: 'right', color: BRAND.muted })
    drawText(`CNPJ: ${FATURANTE.cnpj}  |  IE: ${FATURANTE.ie}`, rightX, topBoxY - 44, {
      size: 8,
      align: 'right',
      color: BRAND.text,
    })
    drawText(`${FATURANTE.cidade}/${FATURANTE.uf} • ${FATURANTE.telefone}`, rightX, topBoxY - 56, {
      size: 8,
      align: 'right',
      color: BRAND.text,
    })
    drawText(FATURANTE.email, rightX, topBoxY - 68, { size: 8, align: 'right', color: BRAND.text })

    return topBoxY - h - 14
  }

  let y = A4_H - M
  y = drawHeader(y)

  const newPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - M
    y = drawHeader(y)
  }

  // ===== BLOCO CLIENTE =====
  const c = (order as any).customerSnapshot || {}
  const cName = safeStr(c.name)
  const cDoc = safeStr(c.doc)
  const cPhone = safeStr(c.phone)
  const cEmail = safeStr(c.email)
  const cAddr = safeStr(c.address)

  const blockH = 98
  drawBox(M, y, W, blockH, undefined)

  drawSectionTitle('DADOS DO CLIENTE', M + 10, y)

  const x1 = M + 10
  const x2 = M + W / 2 + 10
  const topY = y - 34

  drawKV('Cliente', cName, x1, topY, W / 2 - 20)
  drawKV('Documento', cDoc, x1, topY - 14, W / 2 - 20)
  drawKV('Telefone', cPhone, x1, topY - 28, W / 2 - 20)

  drawKV('E-mail', cEmail, x2, topY, W / 2 - 20)

  // Endereço (wrap)
  const addrLabel = 'Endereço:'
  drawText(addrLabel, x2, topY - 14, { bold: true, size: 9 })
  const lw = fontB.widthOfTextAtSize(addrLabel, 9)
  const addrLines = cAddr ? wrapText(cAddr, (W / 2 - 20) - lw - 4, 9).slice(0, 2) : ['—']
  drawText(addrLines[0], x2 + lw + 4, topY - 14, { size: 9, maxWidth: W / 2 - 20 - lw - 4 })
  if (addrLines[1]) drawText(addrLines[1], x2 + lw + 4, topY - 26, { size: 9, maxWidth: W / 2 - 20 - lw - 4 })

  y = y - blockH - 16

  // ===== TABELA (GRID) =====
  drawSectionTitle('ITENS', M + 2, y + 8)
  y -= 12

  // Ajuste de colunas (mais respiro pra “Preço” e “Subtotal” não grudarem)
  const col = {
    idx: M + 10,
    sku: M + 46,
    prod: M + 140,
    und: M + 372,
    qtd: M + 418,
    unit: M + 500, // alinhado à direita
    sub: M + W - 10, // alinhado à direita
  }

  const rowH = 18
  const headH = 22

  const gridXs = [
    M,
    col.sku - 12,
    col.prod - 12,
    col.und - 12,
    col.qtd - 12,
    col.unit - 12,
    M + W,
  ]

  const drawTableHeader = () => {
    drawBox(M, y, W, headH, BRAND.tableHead)

    const ty = y - 15
    drawText('#', col.idx, ty, { bold: true, size: 9 })
    drawText('Código', col.sku, ty, { bold: true, size: 9 })
    drawText('Produto', col.prod, ty, { bold: true, size: 9 })
    drawText('Unid.', col.und, ty, { bold: true, size: 9 })
    drawText('Qtde.', col.qtd, ty, { bold: true, size: 9 })
    drawText('Preço', col.unit, ty, { bold: true, size: 9, align: 'right' })
    drawText('Subtotal', col.sub, ty, { bold: true, size: 9, align: 'right' })

    // linhas verticais do cabeçalho
    const y0 = y - headH
    const y1 = y
    gridXs.forEach((x) => page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: 1, color: BRAND.border }))

    y -= headH
  }

  const needNewPageForRow = () => y - rowH <= M + 200

  drawTableHeader()

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  items.forEach((it: any, idx: number) => {
    if (needNewPageForRow()) {
      newPage()
      y -= 8
      drawSectionTitle('ITENS (continuação)', M + 2, y + 8)
      y -= 12
      drawTableHeader()
    }

    // zebra
    const isZebra = idx % 2 === 1
    drawBox(M, y, W, rowH, isZebra ? BRAND.zebra : undefined)

    const yText = y - 13
    const sku = safeStr(it?.productSnapshot?.sku || it?.sku)
    const name = safeStr(it?.productSnapshot?.name || it?.name)
    const unit = safeStr(it?.productSnapshot?.unit || it?.unit)
    const qty = Number(it?.qty ?? 0)
    const unitPrice = Number(it?.unitPrice ?? 0)
    const subtotal = n2(qty * unitPrice)

    drawText(String(idx + 1), col.idx, yText, { size: 9 })
    drawText(sku || '—', col.sku, yText, { size: 9 })
    drawText(name || '—', col.prod, yText, { size: 9, maxWidth: col.und - col.prod - 16 })
    drawText(unit || '—', col.und, yText, { size: 9 })
    drawText(String(qty || 0), col.qtd, yText, { size: 9 })
    drawText(brl(unitPrice), col.unit, yText, { size: 9, align: 'right' })
    drawText(brl(subtotal), col.sub, yText, { size: 9, align: 'right' })

    // grid da linha
    const y0 = y - rowH
    const y1 = y
    gridXs.forEach((x) => page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: 1, color: BRAND.border }))

    y -= rowH
  })

  // ===== TOTAIS + OBS =====
  if (y <= M + 200) newPage()

  y -= 14

  const totalsBoxW = 230
  const totalsBoxH = 98
  const totalsX = M + W - totalsBoxW

  // Caixa Totais com leve destaque (borda + topo roxo)
  drawBox(totalsX, y, totalsBoxW, totalsBoxH)
  page.drawRectangle({
    x: totalsX,
    y: y - 18,
    width: totalsBoxW,
    height: 18,
    color: BRAND.purpleDark,
  })
  drawText('TOTAIS', totalsX + 10, y - 13, { bold: true, size: 10, color: BRAND.white })

  const t = (order as any).totals || { subtotal: 0, discount: 0, freight: 0, total: 0 }
  const subtotal = n2(Number(t.subtotal ?? 0))
  const discount = n2(Number(t.discount ?? 0))
  const freight = n2(Number(t.freight ?? 0))
  const total = n2(Number(t.total ?? subtotal - discount + freight))

  const tx = totalsX + 10
  const ty = y - 40

  drawText('Subtotal:', tx, ty, { size: 9 })
  drawText(brl(subtotal), totalsX + totalsBoxW - 10, ty, { size: 9, align: 'right' })

  drawText('Desconto:', tx, ty - 14, { size: 9 })
  drawText(brl(discount), totalsX + totalsBoxW - 10, ty - 14, { size: 9, align: 'right' })

  drawText('Frete:', tx, ty - 28, { size: 9 })
  drawText(brl(freight), totalsX + totalsBoxW - 10, ty - 28, { size: 9, align: 'right' })

  page.drawLine({
    start: { x: totalsX + 10, y: ty - 36 },
    end: { x: totalsX + totalsBoxW - 10, y: ty - 36 },
    thickness: 1,
    color: BRAND.border,
  })

  drawText('TOTAL:', tx, ty - 54, { bold: true, size: 11, color: BRAND.purple })
  drawText(brl(total), totalsX + totalsBoxW - 10, ty - 54, { bold: true, size: 11, align: 'right', color: BRAND.purple })

  // Observações
  const notesX = M
  const notesW = W - totalsBoxW - 12
  const notesH = totalsBoxH

  drawBox(notesX, y, notesW, notesH)
  page.drawRectangle({
    x: notesX,
    y: y - 18,
    width: notesW,
    height: 18,
    color: BRAND.bgSoft,
  })
  drawText('OBSERVAÇÕES', notesX + 10, y - 13, { bold: true, size: 10, color: BRAND.purple })

  const notes = safeStr((order as any).notes)
  const maxNotesWidth = notesW - 20
  const noteLines = notes ? wrapText(notes, maxNotesWidth, 9).slice(0, 6) : ['—']
  let ny = y - 40
  noteLines.forEach((ln) => {
    drawText(ln, notesX + 10, ny, { size: 9, maxWidth: maxNotesWidth })
    ny -= 12
  })

  y -= totalsBoxH + 18

  // ===== RODAPÉ =====
  const footerY = M + 22
  page.drawLine({
    start: { x: M, y: footerY + 10 },
    end: { x: A4_W - M, y: footerY + 10 },
    thickness: 1,
    color: BRAND.border,
  })

  drawText(`Gerado em ${formatDatePtBR(Date.now())} • ${FATURANTE.nomeFantasia}`, M, footerY, { size: 8, color: BRAND.muted })

  // ===== DOWNLOAD (TS safe) =====
  const pdfBytes = await pdfDoc.save()

  // Convert Uint8Array<ArrayBufferLike> -> ArrayBuffer
  const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer

  const blob = new Blob([ab], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${K}_${docNumber(order, K)}.pdf`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
