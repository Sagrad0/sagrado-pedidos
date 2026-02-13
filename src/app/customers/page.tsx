'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Address, Customer, CustomerFormData } from '@/types'
import { formatAddress, toAddressObject } from '@/lib/address'
import {
  getAllCustomers,
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@/lib/db/customers'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const addressSchema = z.object({
  raw: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

const customerSchema = z.object({
  name: z.string().min(1, 'Nome fantasia é obrigatório'),
  legalName: z.string().optional(),
  doc: z.string().optional(),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  addressMain: addressSchema.optional(),
  addressDelivery: addressSchema.optional(),
  address: z.string().optional(), // legado
})

type CustomerFormValues = z.infer<typeof customerSchema>

function normalizeAddress(a: any): Address | undefined {
  if (!a) return undefined
  const out: any = {}
  ;['raw', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'].forEach((k) => {
    const v = typeof a?.[k] === 'string' ? a[k].trim() : a?.[k]
    if (v) out[k] = v
  })
  return Object.keys(out).length ? (out as Address) : undefined
}

const trimOrEmpty = (v?: string) => (typeof v === 'string' ? v.trim() : '')

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filtered, setFiltered] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Customer | null>(null)
  const [open, setOpen] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getAllCustomers()
        if (!alive) return
        setCustomers(data)
        setFiltered(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const handleSearch = async (term: string) => {
    setQ(term)
    if (!term.trim()) {
      setFiltered(customers)
      return
    }
    const results = await searchCustomers(term)
    setFiltered(results)
  }

  const openModal = (customer?: Customer) => {
    setSubmitError(null)

    if (customer) {
      setSelected(customer)
      setValue('name', customer.name)
      setValue('legalName', (customer as any).legalName || '')
      setValue('doc', customer.doc || '')
      setValue('phone', customer.phone)
      setValue('email', customer.email || '')

      const main = toAddressObject((customer as any).addressMain || customer.address)
      const delv = toAddressObject((customer as any).addressDelivery)
      setValue('addressMain', (main as any) || ({} as any))
      setValue('addressDelivery', (delv as any) || ({} as any))

      setValue('address', customer.address || '')
    } else {
      setSelected(null)
      reset()
    }

    setOpen(true)
  }

  const closeModal = () => {
    setSelected(null)
    reset()
    setOpen(false)
  }

  const onSubmit = async (values: CustomerFormValues) => {
    setSubmitError(null)

    const legalName = trimOrEmpty(values.legalName) || undefined
    const doc = trimOrEmpty(values.doc) || undefined
    const email = trimOrEmpty(values.email) || undefined

    const addressMain = normalizeAddress(values.addressMain)
    const addressDelivery = normalizeAddress(values.addressDelivery)

    const legacyAddress = trimOrEmpty(values.address) || formatAddress(addressMain) || undefined

    const payload: CustomerFormData = {
      name: trimOrEmpty(values.name),
      phone: trimOrEmpty(values.phone),
      ...(legalName ? { legalName } : {}),
      ...(doc ? { doc } : {}),
      ...(email ? { email } : {}),
      ...(addressMain ? { addressMain } : {}),
      ...(addressDelivery ? { addressDelivery } : {}),
      ...(legacyAddress ? { address: legacyAddress } : {}),
    }

    try {
      if (selected) await updateCustomer(selected.id, payload)
      else await createCustomer(payload)

      const data = await getAllCustomers()
      setCustomers(data)
      setFiltered(data)
      closeModal()
    } catch (err: any) {
      console.error('[CustomersPage.onSubmit] FAILED', err)
      setSubmitError(err?.message || 'Erro ao salvar. Verifique permissões do Firestore.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return
    await deleteCustomer(id)

    const data = await getAllCustomers()
    setCustomers(data)
    setFiltered(data)
  }

  // Preview de endereço no modal (ajuda UX de campo)
  const previewMain = useMemo(() => formatAddress(watch('addressMain') as any), [watch])
  const previewDelivery = useMemo(() => formatAddress(watch('addressDelivery') as any), [watch])

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-subtitle">Cadastros</div>
          <h1 className="page-title">Clientes</h1>
          <div className="text-sm text-slate-500 mt-1">Busca rápida + clique na linha pra editar.</div>
        </div>

        <button onClick={() => openModal()} className="btn btn-primary">
          Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="card">
        <div className="card-body">
          <label className="form-label">Buscar</label>
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Nome, telefone, doc, razão social…"
            className="form-input"
          />
          <div className="form-hint mt-1">Dica: buscar por telefone costuma ser o mais rápido.</div>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Registros</div>
          <div className="text-sm text-slate-500 mono">
            {loading ? 'Carregando…' : `${filtered.length} encontrados`}
          </div>
        </div>

        {loading ? (
          <div className="card-body text-slate-500">Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Doc</th>
                  <th>Endereço</th>
                  <th className="table-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const legalName = (c as any).legalName
                  const addrMain = (c as any).addressMain || c.address
                  const addrText = addrMain ? formatAddress(addrMain) : '-'

                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => openModal(c)}
                      title="Clique para editar"
                    >
                      <td>
                        <div className="font-semibold">{c.name}</div>
                        {legalName ? <div className="text-xs text-slate-500">{legalName}</div> : null}
                      </td>

                      <td className="mono">{c.phone}</td>
                      <td className="mono">{c.doc || '-'}</td>

                      <td>
                        <div className="text-sm text-slate-900 line-clamp-2">{addrText || '-'}</div>
                      </td>

                      <td className="table-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => openModal(c)}>
                            Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-8">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-xs text-slate-500">{selected ? 'Editar' : 'Novo'}</div>
                <div className="text-lg font-semibold text-slate-900">Cliente</div>
              </div>
              <button onClick={closeModal} className="btn btn-ghost btn-sm">
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
              {submitError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                  {submitError}
                </div>
              )}

              {/* Dados */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Dados</div>
                </div>
                <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Nome fantasia*</label>
                    <input {...register('name')} className="form-input" />
                    {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Razão social</label>
                    <input {...register('legalName')} className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Documento (CNPJ/CPF)</label>
                    <input {...register('doc')} className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Telefone*</label>
                    <input {...register('phone')} className="form-input" />
                    {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">E-mail</label>
                    <input {...register('email')} type="email" className="form-input" />
                    {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {/* Endereço principal */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Endereço principal</div>
                  <span className="pill pill-gray">cadastro</span>
                </div>
                <div className="card-body space-y-3">
                  {previewMain ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Prévia</div>
                      <div className="mt-1">{previewMain}</div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-3">
                      <label className="form-label">CEP</label>
                      <input {...register('addressMain.cep')} className="form-input" />
                    </div>
                    <div className="sm:col-span-7">
                      <label className="form-label">Rua / Av.</label>
                      <input {...register('addressMain.street')} className="form-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Nº</label>
                      <input {...register('addressMain.number')} className="form-input" />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="form-label">Bairro</label>
                      <input {...register('addressMain.neighborhood')} className="form-input" />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="form-label">Cidade</label>
                      <input {...register('addressMain.city')} className="form-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">UF</label>
                      <input {...register('addressMain.state')} className="form-input" />
                    </div>

                    <div className="sm:col-span-12">
                      <label className="form-label">Complemento</label>
                      <input {...register('addressMain.complement')} className="form-input" />
                    </div>

                    <div className="sm:col-span-12">
                      <label className="form-label">Texto livre (opcional)</label>
                      <input {...register('addressMain.raw')} className="form-input" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Endereço de entrega */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Endereço de entrega</div>
                  <span className="pill pill-blue">opcional</span>
                </div>
                <div className="card-body space-y-3">
                  {previewDelivery ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Prévia</div>
                      <div className="mt-1">{previewDelivery}</div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-3">
                      <label className="form-label">CEP</label>
                      <input {...register('addressDelivery.cep')} className="form-input" />
                    </div>
                    <div className="sm:col-span-7">
                      <label className="form-label">Rua / Av.</label>
                      <input {...register('addressDelivery.street')} className="form-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Nº</label>
                      <input {...register('addressDelivery.number')} className="form-input" />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="form-label">Bairro</label>
                      <input {...register('addressDelivery.neighborhood')} className="form-input" />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="form-label">Cidade</label>
                      <input {...register('addressDelivery.city')} className="form-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">UF</label>
                      <input {...register('addressDelivery.state')} className="form-input" />
                    </div>

                    <div className="sm:col-span-12">
                      <label className="form-label">Complemento</label>
                      <input {...register('addressDelivery.complement')} className="form-input" />
                    </div>

                    <div className="sm:col-span-12">
                      <label className="form-label">Texto livre (opcional)</label>
                      <input {...register('addressDelivery.raw')} className="form-input" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Legado */}
              <input type="hidden" {...register('address')} />

              {/* Footer */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" onClick={closeModal} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {selected ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
