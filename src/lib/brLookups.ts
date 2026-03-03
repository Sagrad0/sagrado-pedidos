export type ViaCepResult = {
  cep: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

export async function fetchViaCep(cepRaw: string): Promise<ViaCepResult> {
  const cep = String(cepRaw || '').replace(/\D+/g, '')
  if (cep.length !== 8) throw new Error('CEP inválido')

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao consultar CEP')

  const data = (await res.json()) as ViaCepResult
  if ((data as any)?.erro) throw new Error('CEP não encontrado')
  return data
}

// BrasilAPI (CNPJ)
// Docs: https://brasilapi.com.br/
export type BrasilApiCnpjResult = {
  cnpj: string
  razao_social?: string
  nome_fantasia?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
}

export async function fetchCnpj(cnpjRaw: string): Promise<BrasilApiCnpjResult> {
  const cnpj = String(cnpjRaw || '').replace(/\D+/g, '')
  if (cnpj.length !== 14) throw new Error('CNPJ inválido')

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 404) throw new Error('CNPJ não encontrado')
    throw new Error('Falha ao consultar CNPJ')
  }

  return (await res.json()) as BrasilApiCnpjResult
}
