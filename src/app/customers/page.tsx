'use client'

import { useState, useEffect } from 'react'
import { Customer, CustomerFormData } from '@/types'
import { getAllCustomers, searchCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const customerSchema = z.object({
  name: z.string().min(1, 'Nome fantasia é obrigatório'),
  legalName: z.string().optional(),
  doc: z.string().optional(),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  addressMain: z.string().optional(),
  addressDelivery: z.string().optional(),
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
      setValue('addressMain', (customer as any).addressMain || customer.address || '')
      setValue('addressDelivery', (customer as any).addressDelivery || '')
      // legado
      setValue('address', customer.address || '')
    } else {
      setSelectedCustomer(null)
      reset()
    }

    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const onSubmit = async (values: CustomerFormValues) => {
    setSubmitError(null)

    const trimOrEmpty = (v?: string) => (typeof v === 'string' ? v.trim() : '')
    const legalName = trimOrEmpty(values.legalName) || undefined
    const doc = trimOrEmpty(values.doc) || undefined
    const email = trimOrEmpty(values.email) || undefined
    const addressMain = trimOrEmpty(values.addressMain) || undefined
    const addressDelivery = trimOrEmpty(values.addressDelivery) || undefined

    // ✅ legado: só envia se tiver valor.
    // Se não tiver, usa addressMain como compatibilidade (sem mandar undefined).
    const legacyAddress = trimOrEmpty(values.address) || addressMain || undefined

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
        <button onClick={() => openModal()} className="btn btn-primary">
          Novo Cliente
        </button>
      </div>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            className="form-input"
            placeholder="Buscar por nome, telefone, CNPJ..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-gray-600">Carregando...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum cliente encontrado.</p>
          ) : (
            <div className="divide-y">
              {filteredCustomers.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-600 truncate">
                      {[c.phone, c.doc, c.email].filter(Boolean).join(' • ')}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {[(c as any).legalName, (c as any).addressMain || c.address, (c as any).addressDelivery].filter(Boolean).join(' • ')}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => openModal(c)}>
                      Editar
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(c.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              {/* ✅ Mensagem de erro do submit (aparece no iPhone) */}
              {submitError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div>
                <label className="form-label">Nome Fantasia</label>
                <input {...register('name')} className="form-input" />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label">Razão Social</label>
                <input {...register('legalName')} className="form-input" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Telefone</label>
                  <input {...register('phone')} className="form-input" />
                  {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="form-label">CPF/CNPJ</label>
                  <input {...register('doc')} className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Email</label>
                <input {...register('email')} type="email" className="form-input" />
                {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>

              <div>
                <label className="form-label">Endereço Principal</label>
                <input {...register('addressMain')} className="form-input" />
              </div>

              <div>
                <label className="form-label">Endereço de Entrega</label>
                <input {...register('addressDelivery')} className="form-input" />
              </div>

              {/* Campo legado (não exibir normalmente). Mantido para compatibilidade */}
              <input type="hidden" {...register('address')} />

              <div className="pt-2 flex gap-3">
                <button type="submit" className="btn btn-primary flex-1">
                  {selectedCustomer ? 'Salvar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
