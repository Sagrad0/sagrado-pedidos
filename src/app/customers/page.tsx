'use client'

import { useState, useEffect } from 'react'
import { Customer, CustomerFormData, Address } from '@/types'
import { formatAddress, toAddressObject } from '@/lib/address'
import { getAllCustomers, searchCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers'
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
  // legado (mantido)
  address: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // ✅ Observabilidade: erro do submit (pra enxergar no iPhone sem DevTools)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  })

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const data = await getAllCustomers()
      setCustomers(data)
      setFilteredCustomers(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    if (!term) {
      setFilteredCustomers(customers)
      return
    }
    const results = await searchCustomers(term)
    setFilteredCustomers(results)
  }

  const openModal = (customer?: Customer) => {
    // ✅ limpa erro ao abrir modal
    setSubmitError(null)

    if (customer) {
      setSelectedCustomer(customer)
      setValue('name', customer.name)
      setValue('legalName', (customer as any).legalName || '')
      setValue('doc', customer.doc || '')
      setValue('phone', customer.phone)
      setValue('email', customer.email || '')
      setValue('addressMain', (toAddressObject((customer as any).addressMain || customer.address) as any) || ({} as any))
      setValue('addressDelivery', (toAddressObject((customer as any).addressDelivery) as any) || ({} as any))
      // legado
      setValue('address', customer.address || '')
    } else {
      setSelectedCustomer(null)
      reset()
    }

    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedCustomer(null)
    reset()
    setIsModalOpen(false)
  }

  const onSubmit = async (values: CustomerFormValues) => {
    setSubmitError(null)

    const trimOrEmpty = (v?: string) => (typeof v === 'string' ? v.trim() : '')
    const legalName = trimOrEmpty(values.legalName) || undefined
    const doc = trimOrEmpty(values.doc) || undefined
    const email = trimOrEmpty(values.email) || undefined
    const normalizeAddress = (a: any): Address | undefined => {
      if (!a) return undefined
      const out: any = {}
      ;['raw','cep','street','number','complement','neighborhood','city','state'].forEach((k) => {
        const v = typeof a?.[k] === 'string' ? a[k].trim() : a?.[k]
        if (v) out[k] = v
      })
      return Object.keys(out).length ? (out as Address) : undefined
    }

    const addressMain = normalizeAddress(values.addressMain)
    const addressDelivery = normalizeAddress(values.addressDelivery)

    // ✅ legado: só envia se tiver valor.
    // Se não tiver, usa addressMain como compatibilidade (sem mandar undefined).
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
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, payload)
      } else {
        await createCustomer(payload)
      }

      const data = await getAllCustomers()
      setCustomers(data)
      setFilteredCustomers(data)
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
    setFilteredCustomers(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button onClick={() => openModal()} className="btn btn-primary">Novo Cliente</button>
      </div>

      <div className="flex gap-3">
        <input
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, doc..."
          className="form-input flex-1"
        />
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Doc</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">{c.name}</div>
                      {(c as any).legalName && <div className="text-xs text-gray-500">{(c as any).legalName}</div>}
                    </td>
                    <td>{c.phone}</td>
                    <td>{c.doc || '-'}</td>
                    <td className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal(c)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-500 py-6">Nenhum cliente encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-lg font-semibold">{selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {submitError && (
                <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
                  {submitError}
                </div>
              )}

              <div>
                <label className="form-label">Nome Fantasia*</label>
                <input {...register('name')} className="form-input" />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label">Razão Social</label>
                <input {...register('legalName')} className="form-input" />
              </div>

              <div>
                <label className="form-label">Documento (CNPJ/CPF)</label>
                <input {...register('doc')} className="form-input" />
              </div>

              <div>
                <label className="form-label">Telefone*</label>
                <input {...register('phone')} className="form-input" />
                {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="form-label">E-mail</label>
                <input {...register('email')} type="email" className="form-input" />
                {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="form-label">Endereço Principal (objeto)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input {...register('addressMain.cep')} className="form-input" placeholder="CEP" />
                  <input {...register('addressMain.street')} className="form-input sm:col-span-2" placeholder="Rua / Av." />
                  <input {...register('addressMain.number')} className="form-input" placeholder="Número" />
                  <input {...register('addressMain.complement')} className="form-input sm:col-span-2" placeholder="Complemento" />
                  <input {...register('addressMain.neighborhood')} className="form-input" placeholder="Bairro" />
                  <input {...register('addressMain.city')} className="form-input" placeholder="Cidade" />
                  <input {...register('addressMain.state')} className="form-input" placeholder="UF" />
                  <input {...register('addressMain.raw')} className="form-input sm:col-span-3" placeholder="Texto livre (opcional)" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="form-label">Endereço de Entrega (objeto)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input {...register('addressDelivery.cep')} className="form-input" placeholder="CEP" />
                  <input {...register('addressDelivery.street')} className="form-input sm:col-span-2" placeholder="Rua / Av." />
                  <input {...register('addressDelivery.number')} className="form-input" placeholder="Número" />
                  <input {...register('addressDelivery.complement')} className="form-input sm:col-span-2" placeholder="Complemento" />
                  <input {...register('addressDelivery.neighborhood')} className="form-input" placeholder="Bairro" />
                  <input {...register('addressDelivery.city')} className="form-input" placeholder="Cidade" />
                  <input {...register('addressDelivery.state')} className="form-input" placeholder="UF" />
                  <input {...register('addressDelivery.raw')} className="form-input sm:col-span-3" placeholder="Texto livre (opcional)" />
                </div>
              </div>

              {/* Campo legado (não exibir normalmente). Mantido para compatibilidade */}
              <input type="hidden" {...register('address')} />

              <div className="pt-2 flex gap-3">
                <button type="submit" className="btn btn-primary">{selectedCustomer ? 'Salvar' : 'Criar'}</button>
                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
