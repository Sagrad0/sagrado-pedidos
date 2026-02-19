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

const schema = z.object({
  type: z.enum(['PJ', 'PF']),
  doc: z.string().min(1, 'Obrigatório'),
  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  nome: z.string().optional(),
  telefone: z.string().min(1, 'Obrigatório'),
  email: z.string().email('E-mail inválido'),
  ie: z.string().optional(),
  suframa: z.string().optional(),
  fiscalException: z.string().optional(),
  segment: z.string().optional(),
  network: z.string().optional(),
  notes: z.string().optional(),
  addressMain: z.any(),
  addressDelivery: z.any().optional(),
})

type FormValues = z.infer<typeof schema>

const emptyAddress = (): Address => ({
  cep: '',
  street: '',
  number: '',
  district: '',
  city: '',
  uf: '',
  complement: '',
  extra: '',
})

export default function CustomersPage() {
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'PJ',
      doc: '',
      razaoSocial: '',
      nomeFantasia: '',
      nome: '',
      telefone: '',
      email: '',
      ie: '',
      suframa: '',
      fiscalException: '',
      segment: '',
      network: '',
      notes: '',
      addressMain: emptyAddress(),
      addressDelivery: emptyAddress(),
    },
  })

  const type = watch('type')

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((c) => {
      const hay = [
        c.name,
        c.fantasyName,
        c.legalName,
        c.doc,
        c.phone,
        c.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const all = await getAllCustomers()
        setRows(all)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const closeModal = () => {
    setOpen(false)
    setEditing(null)
    setSubmitError(null)
  }

  const openNew = () => {
    setSubmitError(null)
    setEditing(null)
    reset({
      type: 'PJ',
      doc: '',
      razaoSocial: '',
      nomeFantasia: '',
      nome: '',
      telefone: '',
      email: '',
      ie: '',
      suframa: '',
      fiscalException: '',
      segment: '',
      network: '',
      notes: '',
      addressMain: emptyAddress(),
      addressDelivery: emptyAddress(),
    })
    setOpen(true)
  }

  const openEdit = (c: Customer) => {
    setSubmitError(null)
    setEditing(c)

    reset({
      type: (c.type as any) || 'PJ',
      doc: c.doc || '',
      razaoSocial: c.legalName || '',
      nomeFantasia: c.fantasyName || '',
      nome: c.name || '',
      telefone: c.phone || '',
      email: c.email || '',
      ie: c.ie || '',
      suframa: c.suframa || '',
      fiscalException: (c as any).fiscalException || '',
      segment: (c as any).segment || '',
      network: (c as any).network || '',
      notes: (c as any).notes || '',
      addressMain: toAddressObject((c as any).addressMain || c.address || emptyAddress()),
      addressDelivery: toAddressObject((c as any).addressDelivery || emptyAddress()),
    })

    setOpen(true)
  }

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null)
    try {
      const payload: CustomerFormData = {
        type: data.type,
        doc: data.doc,
        legalName: data.type === 'PJ' ? data.razaoSocial || '' : '',
        fantasyName: data.type === 'PJ' ? data.nomeFantasia || '' : '',
        name: data.type === 'PF' ? data.nome || '' : '',
        phone: data.telefone,
        email: data.email,
        ie: data.ie || '',
        suframa: data.suframa || '',
        fiscalException: data.fiscalException || '',
        segment: data.segment || '',
        network: data.network || '',
        notes: data.notes || '',
        addressMain: toAddressObject(data.addressMain),
        addressDelivery: data.addressDelivery
          ? toAddressObject(data.addressDelivery)
          : null,
      }

      if (editing) {
        await updateCustomer(editing.id, payload)
      } else {
        await createCustomer(payload)
      }

      const all = query.trim()
        ? await searchCustomers(query.trim())
        : await getAllCustomers()

      setRows(all)
      closeModal()
    } catch (e: any) {
      setSubmitError(e?.message || 'Erro ao salvar. Tente novamente.')
    }
  }

  const onDelete = async (c: Customer) => {
    if (!confirm('Excluir este cliente?')) return
    await deleteCustomer(c.id)
    const all = query.trim()
      ? await searchCustomers(query.trim())
      : await getAllCustomers()
    setRows(all)
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-slate-500">Busca rápida + clique na linha para editar</p>
        </div>

        <button
          onClick={openNew}
          className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-700"
        >
          Novo cliente
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-600">Buscar</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, telefone, doc, razão social, e-mail..."
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
        />
        <p className="mt-2 text-xs text-slate-500">
          Dica: buscar por telefone costuma ser mais rápido
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Registros
        </div>

        {loading ? (
          <div className="p-6 text-slate-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-500">Nenhum encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tel</th>
                  <th className="px-4 py-3">Doc</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {c.fantasyName || c.legalName || c.name || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.legalName && c.fantasyName ? c.legalName : c.email || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.doc || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatAddress((c as any).addressMain || c.address || null)?.city ||
                        '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(c)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(c)
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[calc(100vh-2rem)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editing ? 'Editar cliente' : 'Novo cliente'}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  cadastro
                </span>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="p-5 space-y-5 flex-1 overflow-y-auto"
            >
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="text-sm font-medium text-slate-600">
                    Tipo de cliente
                  </label>
                  <select
                    {...register('type')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  >
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="PF">Pessoa Física</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600">
                    {type === 'PJ' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input
                    {...register('doc')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                  {errors.doc && (
                    <p className="mt-1 text-xs text-red-600">{errors.doc.message}</p>
                  )}
                </div>
              </div>

              {type === 'PJ' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Razão social
                    </label>
                    <input
                      {...register('razaoSocial')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Nome fantasia
                    </label>
                    <input
                      {...register('nomeFantasia')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-slate-600">Nome</label>
                  <input
                    {...register('nome')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-600">Telefone</label>
                  <input
                    {...register('telefone')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                  {errors.telefone && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.telefone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">E-mail</label>
                  <input
                    {...register('email')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Inscrição estadual
                  </label>
                  <input
                    {...register('ie')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">SUFRAMA</label>
                  <input
                    {...register('suframa')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Clientes com SUFRAMA preenchido terão o IPI zerado em seus pedidos.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Exceção Fiscal
                  </label>
                  <input
                    {...register('fiscalException')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    placeholder="Selecione..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-600">Segmento</label>
                  <input
                    {...register('segment')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    placeholder="Selecione..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Rede</label>
                  <input
                    {...register('network')}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    placeholder="Selecione..."
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600">
                  Informações adicionais
                </label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  placeholder="Adicione aqui quaisquer informações adicionais sobre este cliente."
                />
              </div>

              {/* Endereço principal */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Endereço principal</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                    cadastro
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-slate-600">CEP</label>
                    <input
                      value={(watch('addressMain') as any)?.cep || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          cep: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Rua / Av.
                    </label>
                    <input
                      value={(watch('addressMain') as any)?.street || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          street: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Nº</label>
                    <input
                      value={(watch('addressMain') as any)?.number || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          number: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Bairro
                    </label>
                    <input
                      value={(watch('addressMain') as any)?.district || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          district: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Cidade
                    </label>
                    <input
                      value={(watch('addressMain') as any)?.city || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          city: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Complemento
                    </label>
                    <input
                      value={(watch('addressMain') as any)?.complement || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          complement: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">UF</label>
                    <input
                      value={(watch('addressMain') as any)?.uf || ''}
                      onChange={(e) =>
                        setValue('addressMain', {
                          ...(watch('addressMain') as any),
                          uf: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-600">
                    Texto livre (opcional)
                  </label>
                  <input
                    value={(watch('addressMain') as any)?.extra || ''}
                    onChange={(e) =>
                      setValue('addressMain', {
                        ...(watch('addressMain') as any),
                        extra: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                </div>
              </div>

              {/* Endereço de entrega */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Endereço de entrega</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                    opcional
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-slate-600">CEP</label>
                    <input
                      value={(watch('addressDelivery') as any)?.cep || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          cep: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Rua / Av.
                    </label>
                    <input
                      value={(watch('addressDelivery') as any)?.street || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          street: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Nº</label>
                    <input
                      value={(watch('addressDelivery') as any)?.number || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          number: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Bairro
                    </label>
                    <input
                      value={(watch('addressDelivery') as any)?.district || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          district: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Cidade
                    </label>
                    <input
                      value={(watch('addressDelivery') as any)?.city || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          city: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">
                      Complemento
                    </label>
                    <input
                      value={(watch('addressDelivery') as any)?.complement || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          complement: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">UF</label>
                    <input
                      value={(watch('addressDelivery') as any)?.uf || ''}
                      onChange={(e) =>
                        setValue('addressDelivery', {
                          ...(watch('addressDelivery') as any),
                          uf: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-600">
                    Texto livre (opcional)
                  </label>
                  <input
                    value={(watch('addressDelivery') as any)?.extra || ''}
                    onChange={(e) =>
                      setValue('addressDelivery', {
                        ...(watch('addressDelivery') as any),
                        extra: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting ? 'Salvando…' : editing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
