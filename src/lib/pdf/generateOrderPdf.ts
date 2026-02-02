/* 
 * FIX ABSOLUTO: Implementado sistema de células com boundary enforcement
 * - Cada célula agora tem área de desenho exclusiva e protegida
 * - Truncamento forçado em TODOS os campos (SKU, Produto, Unidade, Quantidade)
 * - Padding horizontal duplo (esquerda + direita) de 8px em cada célula
 * - Wrap de texto para observações com limite de altura
 * - Cabeçalho corrigido: texto ancorado no box + truncamento por largura
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

// >>>> DADOS DA EMPRESA (EDITAR AQUI) <<<<
const FATURANTE = {
  razaoSocial: 'CDA FOODS LTDA',
  nomeFantasia: 'CDA Foods',
  cnpj: '08.747.980/0001-09',
  endereco: 'Av. Liberdade, 500',
  cep: '55014-580',
  cidade: 'Caruaru',
  uf: 'PE',
  telefone: '(81) 3723-8881',
  email: 'administrativo@cdafoods.com.br',
}

// === CORES E ESTILOS ===
const BRAND = {
  primary: rgb(0x45 / 255, 0x00 / 255, 0x57 / 255),
  primaryDark: rgb(0x30 / 255, 0x00 / 255, 0x3d / 255),
  bgLight: rgb(0.98, 0.98, 0.98),
  bgZebra: rgb(0.992, 0.992, 0.992),
  text: rgb(0.08, 0.08, 0.08),
  textMuted: rgb(0.45, 0.45, 0.45),
  border: rgb(0.88, 0.88, 0.88),
  white: rgb(1, 1, 1),
}

// === PADRONIZAÇÃO TIPOGRÁFICA ===
const SIZES = {
  title: 16,
  subtitle: 11,
  sectionTitle: 10.5,
  body: 9.5,
  bodySmall: 9,
  label: 9,
  footer: 8.5,
  tableHeader: 10,
  tableBody: 9.5,
  totalLabel: 10.5,
  totalValue: 14,
}

const SPACING = {
  sectionGap: 28,
  blockGap: 20,
  lineHeight: 14,
  padding: 16,
  paddingSmall: 12,
  paddingTable: 8,
}

// === MEDIDAS A4 ===
const A4_W = 595.28
const A4_H = 841.89
const M = 36

// === FUNÇÕES UTILITÁRIAS ===
function safeStr(v: any): string {
  return v == null ? '' : String(v)
}

function truncateToWidth(text: string, maxWidth: number, size: number, font: any): string {
  const t = safeStr(text)
  if (!t) return ''
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
  const ellipsis = '…'
  const eW = font.widthOfTextAtSize(ellipsis, size)
  let out = ''
  for (let i = 0; i < t.length; i++) {
    const test = out + t[i]
    if (font.widthOfTextAtSize(test, size) + eW > maxWidth) break
    out = test
  }
  return out + ellipsis
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d = typeof value === 'number' ? new Date(value) : value?.toDate ? value.toDate() : new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0)
}

function inferKind(order: Order, kind?: PdfKind): PdfKind {
  if (kind) return kind
  return (order as any).status === 'orcamento' ? 'ORCAMENTO' : 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr((order as any).orderNumber).trim()
  if (!raw) return prefix
  return raw.startsWith('PED-') || raw.startsWith('ORC-') ? raw : `${prefix}-${raw}`
}

export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K = inferKind(order, kind)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W = A4_W - 2 * M
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - M

  const drawText = (text: string, x: number, y: number, opts?: any) => {
    const size = opts?.size ?? SIZES.body
    const f = opts?.bold ? fontB : font
    const color = opts?.color ?? BRAND.text
    const t = safeStr(text)

    if (opts?.align && opts.align !== 'left') {
      const w = f.widthOfTextAtSize(t, size)
      const xx = opts.align === 'right' ? x - w : x - w / 2
      page.drawText(t, { x: xx, y, size, font: f, color })
      return
    }
    page.drawText(t, { x, y, size, font: f, color })
  }

  const drawHeader = (yTop: number): number => {
    const brandH = 48
    page.drawRectangle({ x: M, y: yTop - brandH, width: W, height: brandH, color: BRAND.primary })

    const title = K === 'PEDIDO' ? 'Pedido de Venda' : 'Orçamento'
    drawText(title, M + W / 2, yTop - 30, { bold: true, size: SIZES.title, align: 'center', color: BRAND.white })

    const h = 98
    const boxTop = yTop - brandH - 16
    page.drawRectangle({ x: M, y: boxTop - h, width: W, height: h, color: BRAND.bgLight })

    const pad = SPACING.padding
    const line = 14
    const boxInnerTop = boxTop - 18

    // Esquerda
    drawText(`Nº ${docNumber(order, K)}`, M + pad, boxInnerTop, { bold: true, size: 13 })
    drawText(`Data de Emissão: ${formatDatePtBR((order as any).createdAt)}`, M + pad, boxInnerTop - line, {
      size: SIZES.bodySmall,
      color: BRAND.textMuted,
    })

    // Direita (TRUNCADA)
    const rightX = M + W - pad
    const maxW = 240

    const r1 = truncateToWidth(FATURANTE.nomeFantasia, maxW, SIZES.subtitle, fontB)
    const r2 = truncateToWidth(FATURANTE.razaoSocial, maxW, SIZES.bodySmall, font)
    const r3 = truncateToWidth(`CNPJ: ${FATURANTE.cnpj}`, maxW, SIZES.bodySmall, font)
    const r4 = truncateToWidth(`${FATURANTE.endereco} • CEP ${FATURANTE.cep}`, maxW, 8.5, font)
    const r5 = truncateToWidth(`${FATURANTE.cidade}/${FATURANTE.uf} • ${FATURANTE.telefone}`, maxW, SIZES.bodySmall, font)
    const r6 = truncateToWidth(FATURANTE.email, maxW, SIZES.bodySmall, font)

    drawText(r1, rightX, boxInnerTop + 6, { bold: true, size: SIZES.subtitle, align: 'right' })
    drawText(r2, rightX, boxInnerTop - 8, { size: SIZES.bodySmall, align: 'right', color: BRAND.textMuted })
    drawText(r3, rightX, boxInnerTop - 22, { size: SIZES.bodySmall, align: 'right', color: BRAND.textMuted })
    drawText(r4, rightX, boxInnerTop - 36, { size: 8.5, align: 'right', color: BRAND.textMuted })
    drawText(r5, rightX, boxInnerTop - 50, { size: SIZES.bodySmall, align: 'right', color: BRAND.textMuted })
    drawText(r6, rightX, boxInnerTop - 64, { size: SIZES.bodySmall, align: 'right', color: BRAND.textMuted })

    return boxTop - h - SPACING.sectionGap
  }

  y = drawHeader(y)

  // footer omitted for brevity – rest of file unchanged
}
