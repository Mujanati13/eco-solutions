import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { orderService } from '../../services/orderService'
import { userService } from '../../services/userService'
import stockService from '../../services/stockService'
import variantService from '../../services/variantService'
import googleAuthService from '../../services/googleAuthService'
import './OrderManagment-html.css'

// A lightweight, HTML-only redesign of the Order Management page (no Ant Design, no icons)
// Focus: server-side pagination, minimal DOM, and simple interactions for better performance.

const STATUS_OPTIONS = [
	'pending',
	'confirmed',
	'processing',
	'out_for_delivery',
	'delivered',
	'cancelled',
	'returned',
	'on_hold',
	'import_to_delivery_company',
]

function Select({ value, onChange, children, disabled, className, style }) {
	return (
		<select
			value={value ?? ''}
			onChange={(e) => onChange?.(e.target.value)}
			disabled={disabled}
			className={className}
			style={style}
		>
			{children}
		</select>
	)
}

function TextInput({ value, onChange, placeholder, className, style, onKeyDown }) {
	return (
		<input
			type="text"
			value={value}
			onChange={(e) => onChange?.(e.target.value)}
			placeholder={placeholder}
			className={className}
			style={style}
			onKeyDown={onKeyDown}
		/>
	)
}

function Button({ children, onClick, type = 'button', className, disabled }) {
	return (
		<button type={type} onClick={onClick} className={className} disabled={disabled}>
			{children}
		</button>
	)
}

function Pagination({ page, pages, onPageChange }) {
	const maxButtons = 7
	const start = Math.max(1, page - Math.floor(maxButtons / 2))
	const end = Math.min(pages, start + maxButtons - 1)
	const nums = []
	for (let i = start; i <= end; i++) nums.push(i)

	return (
		<div className="om-pagination">
			<Button onClick={() => onPageChange(1)} disabled={page === 1}>
				« First
			</Button>
			<Button onClick={() => onPageChange(page - 1)} disabled={page === 1}>
				‹ Prev
			</Button>
			{nums.map((n) => (
				<Button
					key={n}
					className={n === page ? 'active' : ''}
					onClick={() => onPageChange(n)}
				>
					{n}
				</Button>
			))}
			<Button onClick={() => onPageChange(page + 1)} disabled={page === pages}>
				Next ›
			</Button>
			<Button onClick={() => onPageChange(pages)} disabled={page === pages}>
				Last »
			</Button>
		</div>
	)
}

const OrderRow = React.memo(function OrderRow({
	order,
	canAssign,
	users,
	onStatusChange,
	onAssign,
	onDelete,
		onEdit,
	selected,
	onToggleSelect,
	t,
}) {
	return (
		<tr>
			<td>
				<input
					type="checkbox"
					checked={!!selected}
					onChange={(e) => onToggleSelect?.(order.id, e.target.checked)}
				/>
			</td>
			<td>{order.order_number}</td>
			<td>{order.customer_name}</td>
			<td>{order.customer_phone}</td>
			<td>{order.customer_city}</td>
			<td className="truncate" title={order.customer_address || ''}>{order.customer_address}</td>
			<td>
				<Select value={order.status} onChange={(val) => onStatusChange(order.id, val)}>
					{STATUS_OPTIONS.map((s) => (
						<option key={s} value={s}>{s}</option>
					))}
				</Select>
			</td>
			<td>{order.total_amount || 0} DA</td>
			{canAssign && (
				<td>
					<Select
							value={order.assigned_to ?? ''}
						onChange={(val) => onAssign(order.id, val || null)}
					>
							<option value="">{t?.('orders.unassigned') || 'Unassigned'}</option>
						{users.map((u) => (
							<option key={u.id} value={u.id}>
								{u.first_name || ''} {u.last_name || ''} ({u.username})
							</option>
						))}
					</Select>
				</td>
			)}
			<td>{new Date(order.created_at).toLocaleDateString()}</td>
			<td className="truncate" title={order.notes || ''}>{order.notes}</td>
			<td>
				<Button onClick={() => onEdit?.(order)}>{t?.('common.edit') || 'Edit'}</Button>
				<Button onClick={() => onDelete(order.id)} style={{ marginLeft: 8 }}>{t?.('common.delete') || 'Delete'}</Button>
			</td>
		</tr>
	)
})

export default function OrderManagmentHTML() {
	const { t } = useTranslation()
	const { user } = useAuth()

	const isAdmin = user?.role === 'admin'
	const isSupervisor = user?.role === 'supervisor' || isAdmin
	const canAssignOrders = isAdmin || isSupervisor
	const canDeleteOrders = isAdmin

	// Data
	const [orders, setOrders] = useState([])
	const [users, setUsers] = useState([])
	// Products & variants (for matching)
	const [products, setProducts] = useState([])
	const [loadingProducts, setLoadingProducts] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState(null)
	const [variants, setVariants] = useState([])

	// UI state
	const [loading, setLoading] = useState(false)
	const [usersLoading, setUsersLoading] = useState(false)
	const [error, setError] = useState(null)

	// Selection state for table rows
	const [selectedIds, setSelectedIds] = useState(new Set())
	const headerSelectRef = useRef(null)
	const [bulkAssignUserId, setBulkAssignUserId] = useState('')

	// Filters + pagination
	const [page, setPage] = useState(1)
	const [limit, setLimit] = useState(20)
	const [totalPages, setTotalPages] = useState(1)
	const [totalItems, setTotalItems] = useState(0)

	const [statusFilter, setStatusFilter] = useState('')
	const [assignedFilter, setAssignedFilter] = useState('') // '', 'null', 'not_null', or userId
	const [searchText, setSearchText] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')

		// Edit modal state
		const [editOpen, setEditOpen] = useState(false)
		const [editOriginal, setEditOriginal] = useState(null)
		const [editData, setEditData] = useState({})
			const editProductDetailsRef = useRef(null)
			const finalTotalManualRef = useRef(false)
		const [editLoading, setEditLoading] = useState(false)
		const [wilayas, setWilayas] = useState([])
		const [baladias, setBaladias] = useState([])
		const [loadingWilayas, setLoadingWilayas] = useState(false)
		const [loadingBaladias, setLoadingBaladias] = useState(false)
			const [ecotrackStations, setEcotrackStations] = useState([])
			const [loadingStations, setLoadingStations] = useState(false)

	// Load products once for matching
	const fetchProducts = useCallback(async () => {
		if (loadingProducts || products.length) return
		try {
			setLoadingProducts(true)
			const res = await stockService.getProducts({ limit: 1000 })
			const list = res?.products || res?.data || []
			setProducts(Array.isArray(list) ? list : [])
		} catch (e) {
			console.warn('Failed to load products', e)
		} finally {
			setLoadingProducts(false)
		}
	}, [loadingProducts, products.length])

	const loadVariants = useCallback(async (productId) => {
		if (!productId) { setVariants([]); return }
		try {
			const resp = await variantService.getVariantsByProduct(productId)
			const list = resp?.variants || resp?.data || []
			setVariants(Array.isArray(list) ? list : [])
		} catch (e) {
			setVariants([])
		}
	}, [])

	// Debounce search
	useEffect(() => {
		const id = setTimeout(() => setDebouncedSearch(searchText.trim()), 350)
		return () => clearTimeout(id)
	}, [searchText])

	const fetchUsersIfNeeded = useCallback(async () => {
		if (!canAssignOrders || usersLoading || users.length) return
		try {
			setUsersLoading(true)
			const data = await userService.getUsers({ limit: 1000 })
			const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
			setUsers(list)
		} catch (e) {
			// no toast framework; keep silent or console
			console.warn('Failed to load users', e)
		} finally {
			setUsersLoading(false)
		}
	}, [canAssignOrders, usersLoading, users.length])

			const buildQuery = useCallback(() => {
			const params = { page, limit, sort_by: 'created_at', sort_order: 'DESC' }
			if (statusFilter) params.status = statusFilter
			if (assignedFilter) params.assigned_to = assignedFilter
			if (debouncedSearch) {
					const s = debouncedSearch
					const onlyDigits = s.replace(/\D/g, '')
					const hasAtLeast8Digits = onlyDigits.length >= 8 // phone numbers usually >= 8 digits
					const looksOrderNumber = /^\s*[A-Za-z]*[-_]?[0-9]{3,}\s*$/.test(s)

					if (hasAtLeast8Digits) {
						// Treat as phone search
						params.customer_phone = s
					} else if (looksOrderNumber) {
						params.order_number = s
					} else {
						params.customer_name = s
					}
			}
			return params
		}, [page, limit, statusFilter, assignedFilter, debouncedSearch])

	const fetchOrders = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const params = buildQuery()
			const res = await orderService.getOrders(params)
			const list = Array.isArray(res?.orders) ? res.orders : []
			const pg = res?.pagination || { page: 1, pages: 1, total: list.length, limit }
			setOrders(list)
			// Clear selection when new page loads
			setSelectedIds(new Set())
			setPage(pg.page || 1)
			setTotalPages(pg.pages || 1)
			setTotalItems(pg.total || list.length)
		} catch (e) {
			setError(e?.response?.data?.error || e?.message || 'Failed to load orders')
		} finally {
			setLoading(false)
		}
	}, [buildQuery, limit])

	// Initial load + whenever filters/pagination change
	useEffect(() => {
		fetchOrders()
	}, [fetchOrders])

	// Load users list once if permitted
	useEffect(() => {
		fetchUsersIfNeeded()
	}, [fetchUsersIfNeeded])

		// Wilayas/Baladias helpers
		const loadWilayas = useCallback(async () => {
			if (wilayas.length || loadingWilayas) return
			try {
				setLoadingWilayas(true)
				const res = await orderService.getWilayas()
				const data = res?.data || res?.wilayas || []
				if (res?.success && Array.isArray(res.data)) setWilayas(res.data)
				else setWilayas(Array.isArray(data) ? data : [])
			} finally {
				setLoadingWilayas(false)
			}
		}, [wilayas.length, loadingWilayas])

		const loadBaladias = useCallback(async (wilayaId) => {
			if (!wilayaId) { setBaladias([]); return }
			try {
				setLoadingBaladias(true)
				const res = await orderService.getBaladiasByWilaya(wilayaId)
				const data = res?.data || []
				setBaladias(Array.isArray(data) ? data : [])
			} finally {
				setLoadingBaladias(false)
			}
		}, [])

	// Mirror status changes back to Google Sheets when the order came from a sheet
	const updateOrderStatusInGoogleSheets = useCallback(async (order, newStatus) => {
		try {
			if (!order || !order.order_number) return
			if (!order.source_spreadsheet_id) return
			await googleAuthService.updateOrderStatusInSheet(
				order.source_spreadsheet_id,
				order.order_number,
				newStatus,
				order.source_sheet_name || 'Sheet1'
			)
		} catch (err) {
			console.warn('Google Sheets update failed:', err?.message || err)
		}
	}, [])

	// Handlers
	const handleStatusChange = async (orderId, newStatus) => {
		// Prevent setting 'import_to_delivery_company' unless current status is confirmed
		if (newStatus === 'import_to_delivery_company') {
			const current = orders.find(o => o.id === orderId)
			if (current && current.status !== 'confirmed') {
				alert(t('orders.onlyConfirmedOrdersAllowed') || 'Only confirmed orders can be sent to delivery company')
				return
			}
		}
		try {
				// Optimistic update
				const current = orders.find(o => o.id === orderId)
			setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
				await orderService.updateOrderStatus(orderId, newStatus)
				// Mirror to Google Sheets if applicable (non-blocking)
				if (current) updateOrderStatusInGoogleSheets(current, newStatus)
		} catch (e) {
			// Revert by refetching minimal page
			await fetchOrders()
			alert('Failed to update status')
		}
	}

	const handleAssign = async (orderId, userIdOrNull) => {
		try {
			setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, assigned_to: userIdOrNull ? Number(userIdOrNull) : null } : o)))
			if (userIdOrNull) {
				await orderService.assignOrder(orderId, Number(userIdOrNull))
			} else {
				// Unassign by setting null: reuse assign API with invalid? Backend requires assigned_to; fallback put update
				await orderService.updateOrder(orderId, { assigned_to: null })
			}
		} catch (e) {
			await fetchOrders()
			alert(t('orders.assignError') || 'Failed to assign order')
		}
	}

	const handleDelete = async (orderId) => {
		if (!canDeleteOrders) return
		if (!window.confirm(t('orders.deleteConfirm') || t('common.confirmDelete') || 'Delete this order?')) return
		try {
			await orderService.deleteOrder(orderId)
			setOrders((prev) => prev.filter((o) => o.id !== orderId))
		} catch (e) {
			alert(t('orders.deleteError') || 'Failed to delete order')
		}
	}

		const handleOpenEdit = async (order) => {
			setEditOriginal(order)
			// Initialize editable data
				let productDetails = {}
				try {
					productDetails = typeof order.product_details === 'string' ? JSON.parse(order.product_details) : (order.product_details || {})
				} catch { productDetails = {} }
				editProductDetailsRef.current = productDetails
			setEditData({
				customer_name: order.customer_name || '',
				customer_phone: order.customer_phone || '',
				customer_address: order.customer_address || '',
				customer_city: order.customer_city || '',
				total_amount: order.total_amount ?? '',
						notes: order.notes || '',
						quantity: order.quantity ?? 1,
						final_total: order.final_total ?? Number(order.total_amount || 0) * Number(order.quantity || 1) + Number(order.delivery_price || 0),
				status: order.status || 'pending',
				assigned_to: order.assigned_to ?? '',
				wilaya_id: order.wilaya_id || '',
				baladia_id: order.baladia_id || '',
				delivery_type: order.delivery_type || 'home',
				delivery_price: order.delivery_price ?? '',
				weight: order.weight || 1,
						ecotrack_station_code: order.ecotrack_station_code || '',
						product_link: productDetails.external_link || productDetails.product_link || '',
	          product_name: productDetails.name || '',
	          product_variant: productDetails.variant || productDetails.matched_variant_name || ''
			})
							finalTotalManualRef.current = false
			setEditOpen(true)
			fetchUsersIfNeeded()
			await loadWilayas()
			if (order.wilaya_id) await loadBaladias(order.wilaya_id)
					// Load EcoTrack stations lazily
					if (!ecotrackStations.length) {
						try {
							setLoadingStations(true)
							const resp = await fetch('/api/ecotrack/stations', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
							if (resp.ok) {
								const data = await resp.json()
								if (data?.success && Array.isArray(data.data)) setEcotrackStations(data.data)
							}
						} catch (_) {
							// ignore
						} finally {
							setLoadingStations(false)
						}
					}

			// Auto-recalculate delivery price on open (same as clicking Recalculate)
			try {
				const w = order.wilaya_id || undefined
				const d = order.delivery_type || 'home'
				const wt = order.weight || 1
				if (w) await calculateEditDeliveryPrice(w, d, wt)
			} catch { /* ignore */ }

			// Pre-select matched product if we can find by name
			if (productDetails?.name) {
				await fetchProducts()
				const name = String(productDetails.name).toLowerCase().trim()
				const matched = (products || []).find(p => {
					const db = (p.name || '').toLowerCase().trim()
					if (!db) return false
					if (db === name) return true
					if (db.includes(name) || name.includes(db)) return true
					const norm = (s) => s.replace(/[^a-z0-9\s]/gi,'').replace(/\s+/g,' ')
					return norm(db) === norm(name) || norm(db).includes(norm(name)) || norm(name).includes(norm(db))
				})
				if (matched) {
					setSelectedProduct(matched)
					await loadVariants(matched.id)
				} else {
					setSelectedProduct(null); setVariants([])
				}
			} else {
				// ensure product list is present for manual match later
				fetchProducts()
			}
		}

			const handleEditChange = (field, value) => {
				setEditData((p) => {
					const next = { ...p, [field]: value }
					if (field === 'wilaya_id') {
						next.baladia_id = ''
					}
					// Keep final_total in sync when these change
						if (field === 'final_total') {
							// Manual override: mark as manual and set explicitly
							finalTotalManualRef.current = true
							const num = Number(value || 0)
							next.final_total = isNaN(num) ? value : num
						} else if ((field === 'delivery_price' || field === 'total_amount' || field === 'quantity') && !finalTotalManualRef.current) {
							next.final_total = computeFinalTotal(field === 'total_amount' ? value : next.total_amount, field === 'quantity' ? value : next.quantity, field === 'delivery_price' ? value : next.delivery_price)
						}
					return next
				})
			if (field === 'wilaya_id') {
				loadBaladias(value)
				// recalc after selection
				setTimeout(() => calculateEditDeliveryPrice(value, undefined, undefined), 0)
			}
						if (field === 'delivery_type' || field === 'weight' || field === 'quantity') {
							setTimeout(() => calculateEditDeliveryPrice(undefined, field === 'delivery_type' ? value : undefined, field === 'weight' ? Number(value) : undefined), 0)
			}
		}

				const calculateEditDeliveryPrice = async (wilayaOverride, typeOverride, weightOverride) => {
				const w = (wilayaOverride ?? editData.wilaya_id)
				let dType = typeOverride ?? editData.delivery_type
				if (!dType) dType = 'home'
					let wt = weightOverride ?? editData.weight
					if (!wt) wt = 1
					// Effective weight considers quantity if > 1
					const qty = Number(editData.quantity || 1)
					const effectiveWeight = Number(wt) * (isNaN(qty) ? 1 : Math.max(1, qty))
				if (!w) return

				// Skip auto-calculation for 'les_changes' (manual entry expected)
				if (dType === 'les_changes') return

				try {
						const payload = {
						wilaya_id: w,
						delivery_type: dType,
							weight: effectiveWeight,
						pricing_level: 'wilaya'
					}
					const res = await orderService.calculateDeliveryPrice(payload)
					if (res?.success && res.data) {
						const price = res.data.price ?? res.data.delivery_price ?? 0
									setEditData((p) => ({ ...p, delivery_price: price, final_total: finalTotalManualRef.current ? p.final_total : computeFinalTotal(p.total_amount, p.quantity, price) }))
									if (!finalTotalManualRef.current) finalTotalManualRef.current = false
						return
					}
				} catch (e) {
					// fall through to fallback
				}
				// Fallback by major wilaya code grouping
				try {
					// Need wilaya code; find from cached list
					const wObj = wilayas.find((x) => String(x.id) === String(w))
					const code = wObj?.code ? String(wObj.code) : ''
					const major = ['16','31','25','19','06','21','23']
					const fallback = major.includes(code) ? 400 : 600
								setEditData((p) => ({ ...p, delivery_price: fallback, final_total: finalTotalManualRef.current ? p.final_total : computeFinalTotal(p.total_amount, p.quantity, fallback) }))
				} catch { /* ignore */ }
			}

				const computeFinalTotal = (unitOrTotalAmount, quantity, deliveryPrice) => {
					const qty = Number(quantity || 1)
					const base = Number(unitOrTotalAmount || 0)
					const del = Number(deliveryPrice || 0)
					return qty * base + del
				}

			// Product matching helpers
			const matchProductByName = async () => {
				const name = (editData.product_name || '').trim()
				if (!name) return
				await fetchProducts()
				const clean = name.toLowerCase()
				const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/gi,'').replace(/\s+/g,' ').trim()
				let matched = products.find(p => (p.name || '').toLowerCase().trim() === clean)
				if (!matched) matched = products.find(p => (p.name || '').toLowerCase().includes(clean))
				if (!matched) matched = products.find(p => clean.includes((p.name || '').toLowerCase()))
				if (!matched) matched = products.find(p => norm(p.name || '') === norm(name))
				if (!matched) matched = products.find(p => norm(p.name || '').includes(norm(name)) || norm(name).includes(norm(p.name || '')))
				if (matched) {
					setSelectedProduct(matched)
					await loadVariants(matched.id)
					// If product has a selling price, sync as unit price
					const unit = Number(matched.selling_price || 0)
					setEditData(p => ({...p, total_amount: unit || p.total_amount }))
					// Merge name & link into product_details
					const pd = editProductDetailsRef.current || {}
					const updated = { ...pd, name: matched.name }
					if (matched.external_link) updated.external_link = matched.external_link
					editProductDetailsRef.current = updated
				} else {
					alert('No matching product found')
				}
			}

			const handleVariantSelect = (variantId) => {
				const v = variants.find(x => String(x.id) === String(variantId))
				if (!v) return
				// Update unit price if variant has a price
				const unit = Number(v.selling_price || v.cost_price || editData.total_amount || 0)
				setEditData(p => ({...p, product_variant: v.variant_name || p.product_variant, total_amount: unit}))
				const pd = editProductDetailsRef.current || {}
				editProductDetailsRef.current = { ...pd, matched_variant_id: v.id, matched_variant_name: v.variant_name, matched_variant_sku: v.sku }
			}

			const handleSaveEdit = async () => {
			if (!editOriginal) return
			setEditLoading(true)
			try {
							const allowed = [
							'customer_name','customer_phone','customer_address','customer_city','total_amount','notes','status','assigned_to',
									'wilaya_id','baladia_id','delivery_type','delivery_price','product_weight','quantity','quantity_ordered','final_total','ecotrack_station_code','product_details'
						]
				const payload = {}
							// map fields and normalize
								const draft = { ...editData }
						if ('weight' in draft) {
							draft.product_weight = Number(draft.weight)
							delete draft.weight
						}
								// Coerce numeric fields that the backend expects as numbers
								if ('total_amount' in draft) draft.total_amount = Number(draft.total_amount || 0)
								if ('delivery_price' in draft) draft.delivery_price = Number(draft.delivery_price || 0)
								if ('quantity' in draft) draft.quantity = Number(draft.quantity || 1)
								// Backward compatibility: include quantity_ordered like original modal
								draft.quantity_ordered = draft.quantity
								if ('final_total' in draft) draft.final_total = Number(draft.final_total || 0)
								// Coerce ids to numbers when present; normalize empty selections to null
								if (draft.wilaya_id === '') draft.wilaya_id = null
								if (draft.baladia_id === '') draft.baladia_id = null
								if (draft.wilaya_id !== undefined && draft.wilaya_id !== null) draft.wilaya_id = Number(draft.wilaya_id)
								if (draft.baladia_id !== undefined && draft.baladia_id !== null) draft.baladia_id = Number(draft.baladia_id)
								if (draft.ecotrack_station_code === '') draft.ecotrack_station_code = null
								// Merge product link into product_details JSON
								const currentPD = editProductDetailsRef.current || {}
								const updatedPD = { ...currentPD }
										if (typeof draft.product_link === 'string') {
									if (draft.product_link.trim() === '') {
										delete updatedPD.external_link
									} else {
										updatedPD.external_link = draft.product_link.trim()
									}
								}
										if (typeof draft.product_name === 'string' && draft.product_name.trim()) {
											updatedPD.name = draft.product_name.trim()
										}
										if (typeof draft.product_variant === 'string' && draft.product_variant.trim()) {
											updatedPD.variant = draft.product_variant.trim()
										}
										// Only include product_details if we have any keys (avoid wiping existing details unintentionally)
										if (Object.keys(updatedPD).length > 0) {
											draft.product_details = JSON.stringify(updatedPD)
										}
						for (const k of allowed) if (draft[k] !== undefined) payload[k] = draft[k]
						if ('assigned_to' in payload) {
							payload.assigned_to = payload.assigned_to ? Number(payload.assigned_to) : null
						}
				await orderService.updateOrder(editOriginal.id, payload)
				// Update local table optimistically
								setOrders((prev) => prev.map((o) => (o.id === editOriginal.id ? { ...o, ...payload, product_details: draft.product_details ?? o.product_details } : o)))
				// If status changed, mirror to Google Sheets (non-blocking)
				try {
					if (payload.status && payload.status !== editOriginal.status) {
						const mergedOrder = { ...editOriginal, ...payload }
						updateOrderStatusInGoogleSheets(mergedOrder, payload.status)
					}
				} catch {}
				// Also refetch from server to ensure full consistency (server-side computed fields)
				try { await fetchOrders() } catch {}
				setEditOpen(false)
				setEditOriginal(null)
				setEditData({})
			} catch (e) {
				alert('Failed to save changes')
			} finally {
				setEditLoading(false)
			}
		}

		const handleCloseEdit = () => {
			if (editLoading) return
			setEditOpen(false)
			setEditOriginal(null)
			setEditData({})
		}

	// Reset to page 1 when filters change
	useEffect(() => {
		setPage(1)
	}, [statusFilter, assignedFilter, debouncedSearch, limit])

	const onSubmitSearch = (e) => {
		e?.preventDefault()
		setDebouncedSearch(searchText.trim())
	}

	// Keep header checkbox indeterminate state in sync
	useEffect(() => {
		if (!headerSelectRef.current) return
		const total = orders.length
		const sel = selectedIds.size
		headerSelectRef.current.indeterminate = sel > 0 && sel < total
	}, [orders, selectedIds])

	const toggleSelect = (id) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelectAll = (checked) => {
		if (checked) setSelectedIds(new Set(orders.map(o => o.id)))
		else setSelectedIds(new Set())
	}

	const clearSelection = () => setSelectedIds(new Set())

	const bulkAssign = async () => {
		if (!bulkAssignUserId) return alert(t('orders.selectUserFirst') || 'Pick a user')
		try {
			for (const id of selectedIds) {
				await handleAssign(id, bulkAssignUserId)
			}
			await fetchOrders()
			clearSelection()
			setBulkAssignUserId('')
		} catch (_) {
			// per-item errors handled inside handleAssign
		}
	}

	const bulkSendToDeliveryCompany = async () => {
		try {
			let processed = 0
			let skipped = 0
			for (const id of selectedIds) {
				const o = orders.find(x => x.id === id)
				if (!o || o.status !== 'confirmed') { skipped++; continue }
				setOrders((prev) => prev.map((oo) => (oo.id === id ? { ...oo, status: 'import_to_delivery_company' } : oo)))
				try {
					await orderService.updateOrderStatus(id, 'import_to_delivery_company')
					// Update Google Sheets for this order if it originated from Google
					updateOrderStatusInGoogleSheets(o, 'import_to_delivery_company')
					processed++
				} catch (e) {
					// count as skipped on failure
					skipped++
				}
			}
			await fetchOrders()
			clearSelection()
			if (skipped > 0) {
				alert(t('orders.onlyConfirmedOrdersAllowed') || 'Only confirmed orders can be sent to delivery company')
			}
		} catch (_) {
			await fetchOrders()
			alert('Failed to update some orders')
		}
	}

	const bulkDelete = async () => {
		if (!canDeleteOrders) return
		if (!window.confirm(t('orders.bulkDeleteConfirm', { count: selectedIds.size }) || t('common.confirmDelete') || 'Delete selected orders?')) return
		try {
			for (const id of selectedIds) {
				await orderService.deleteOrder(id)
			}
			await fetchOrders()
			clearSelection()
		} catch (_) {
			await fetchOrders()
			alert(t('orders.deleteError') || 'Failed to delete some orders')
		}
	}

	const empty = !loading && orders.length === 0

	// Export current filtered orders (all pages) to Excel only
	const handleExportExcel = useCallback(async () => {
		try {
			const params = { ...buildQuery(), page: 1, limit: 10000 }
			const res = await orderService.getOrders(params)
			const data = Array.isArray(res?.orders) ? res.orders : []
			if (!data.length) { alert(t('common.noData') || 'Nothing to export'); return }
			const rows = data.map(o => ({
				order_number: o.order_number,
				customer_name: o.customer_name,
				customer_phone: o.customer_phone,
				customer_city: o.customer_city,
				customer_address: o.customer_address,
				status: o.status,
				total_amount: o.total_amount,
				delivery_price: o.delivery_price,
				final_total: o.final_total,
				assigned_to: o.assigned_to,
				created_at: o.created_at,
				notes: o.notes
			}))
			const ws = XLSX.utils.json_to_sheet(rows)
			const wb = XLSX.utils.book_new()
			XLSX.utils.book_append_sheet(wb, ws, 'Orders')
			XLSX.writeFile(wb, 'orders.xlsx')
		} catch (e) {
			alert(t('common.exportError') || 'Export failed')
		}
	}, [buildQuery, t])

	const hasSelection = selectedIds.size > 0
	const allSelectedConfirmed = hasSelection && Array.from(selectedIds).every(id => {
		const o = orders.find(x => x.id === id)
		return o && o.status === 'confirmed'
	})

	return (
		<div className={`om-wrap ${hasSelection ? 'has-bulkbar' : ''}`}>
			<h1 className="om-title">{t('orders.orderManagement') || 'Order Management'}</h1>

			<form className="om-filters" onSubmit={onSubmitSearch}>
				<div className="row">
					<label>{t('common.search') || 'Search'}</label>
					<TextInput
						value={searchText}
						onChange={setSearchText}
						placeholder={t('orders.searchByNameOrPhone') || 'Name or Order #'}
						onKeyDown={(e) => e.key === 'Enter' && onSubmitSearch(e)}
					/>
					<Button type="submit">{t('common.search') || 'Search'}</Button>
					<Button onClick={() => { setSearchText(''); setDebouncedSearch('') }}>{t('common.clear') || 'Clear'}</Button>
				</div>

				<div className="row">
					<label>{t('orders.status') || 'Status'}</label>
					<Select value={statusFilter} onChange={setStatusFilter}>
						<option value="">{t('common.all') || 'All'}</option>
						{STATUS_OPTIONS.map((s) => (
							<option key={s} value={s}>{s}</option>
						))}
					</Select>

					<label>{t('orders.assigned') || 'Assigned'}</label>
					<Select value={assignedFilter} onChange={setAssignedFilter}>
						<option value="">{t('common.all') || 'All'}</option>
						<option value="null">{t('orders.unassigned') || 'Unassigned'}</option>
						<option value="not_null">{t('orders.assigned') || 'Assigned'}</option>
						{canAssignOrders && users.length > 0 && (
							<optgroup label={t('orders.byUser') || 'By user'}>
								{users.map((u) => (
									<option key={u.id} value={String(u.id)}>
										{u.first_name || ''} {u.last_name || ''} ({u.username})
									</option>
								))}
							</optgroup>
						)}
					</Select>

					<label>{t('common.pageSize') || 'Page size'}</label>
					<Select value={String(limit)} onChange={(v) => setLimit(Number(v))}>
						{[10, 20, 50, 100].map((n) => (
							<option key={n} value={String(n)}>{n}</option>
						))}
					</Select>

					<span style={{ marginLeft: 12 }} />
					<Button onClick={handleExportExcel}>{t('common.exportExcel') || 'Export Excel'}</Button>
				</div>
			</form>

			{error && <div className="om-error">{String(error)}</div>}

			<div className="om-table-wrap">
				{/* Bulk actions bar */}
				{selectedIds.size > 0 && (
					<div className="om-bulkbar">
						<strong>{t('orders.selectedCount', { count: selectedIds.size }) || `${selectedIds.size} selected`}</strong>
						<Button onClick={clearSelection} style={{ marginLeft: 8 }}>{t('common.clear') || 'Clear'}</Button>
						{canAssignOrders && (
							<span style={{ marginLeft: 16 }}>
								<label style={{ marginRight: 6 }}>{t('orders.assignTo') || 'Assign to'}</label>
								<Select value={bulkAssignUserId} onChange={setBulkAssignUserId} style={{ maxWidth: 220 }}>
									<option value="">{t('orders.selectUser') || 'Select user'}</option>
									{users.map(u => (
										<option key={u.id} value={String(u.id)}>{u.first_name || ''} {u.last_name || ''} ({u.username})</option>
									))}
								</Select>
								<Button onClick={bulkAssign} style={{ marginLeft: 6 }}>{t('orders.apply') || 'Apply'}</Button>
							</span>
						)}
						<span style={{ marginLeft: 16 }}>
							<Button onClick={bulkSendToDeliveryCompany} disabled={!allSelectedConfirmed}>
								{t('orders.sendToDeliveryCompany') || 'Send to Delivery Company'}
							</Button>
						</span>
						{canDeleteOrders && (
							<span style={{ marginLeft: 16 }}>
								<Button onClick={bulkDelete}>{t('common.delete') || 'Delete'}</Button>
							</span>
						)}
					</div>
				)}
				<table className="om-table">
					<thead>
						<tr>
							<th>
								<input
									type="checkbox"
									ref={headerSelectRef}
									checked={orders.length > 0 && selectedIds.size === orders.length}
									onChange={(e) => toggleSelectAll(e.target.checked)}
								/>
							</th>
							<th>{t('orders.orderNumber') || 'Order #'}</th>
							<th>{t('orders.customerName') || 'Customer'}</th>
							<th>{t('orders.customerPhone') || 'Phone'}</th>
							<th>{t('orders.customerCity') || 'City'}</th>
							<th>{t('orders.customerAddress') || 'Address'}</th>
							<th>{t('orders.status') || 'Status'}</th>
							<th>{t('common.total') || 'Total'}</th>
							{canAssignOrders && <th>{t('orders.assignedTo') || 'Assigned To'}</th>}
							<th>{t('orders.createdAt') || 'Created'}</th>
							<th>{t('orders.notes') || 'Notes'}</th>
							<th>{t('common.actions') || 'Actions'}</th>
						</tr>
					</thead>
					<tbody>
						{loading && (
							<tr><td colSpan={canAssignOrders ? 12 : 11}>{t('common.loading') || 'Loading…'}</td></tr>
						)}
						{empty && (
							<tr><td colSpan={canAssignOrders ? 12 : 11}>{t('orders.noOrders') || 'No orders found'}</td></tr>
						)}
						{!loading && orders.map((o) => (
							<OrderRow
								key={o.id}
								order={o}
								canAssign={canAssignOrders}
								users={users}
								onStatusChange={handleStatusChange}
								onAssign={handleAssign}
								onDelete={canDeleteOrders ? handleDelete : () => {}}
										onEdit={handleOpenEdit}
								selected={selectedIds.has(o.id)}
								onToggleSelect={(id, checked) => toggleSelect(id)}
								t={t}
							/>
						))}
					</tbody>
				</table>
			</div>

			<div className="om-footer">
				<div className="om-summary">
					<span>{t('common.pagination', { start: (page - 1) * limit + 1, end: Math.min(page * limit, totalItems), total: totalItems }) || `Showing ${((page - 1) * limit + 1)} to ${Math.min(page * limit, totalItems)} of ${totalItems} entries`}</span>
				</div>
				<Pagination page={page} pages={totalPages} onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))} />
			</div>

					{editOpen && (
						<div className="om-modal-backdrop" role="dialog" aria-modal="true">
							<div className="om-modal">
								<div className="om-modal-header">
									<h2>{t('orders.editOrder') || 'Edit Order'}</h2>
								</div>
											<div className="om-modal-body">
												<div className="om-section">
													<h3 className="om-section-title">{t('orders.customer') || 'Customer'}</h3>
													<div className="om-form-grid">
														  <label>{t('orders.customerName') || 'Customer name'}
											<TextInput value={editData.customer_name} onChange={(v) => handleEditChange('customer_name', v)} />
														</label>
														  <label>{t('orders.phone') || 'Phone'}
											<TextInput value={editData.customer_phone} onChange={(v) => handleEditChange('customer_phone', v)} />
														</label>
														  <label>{t('orders.address') || 'Address'}
											<TextInput value={editData.customer_address} onChange={(v) => handleEditChange('customer_address', v)} />
														</label>
														  <label>{t('orders.city') || 'City'}
															<TextInput value={editData.customer_city} onChange={(v) => handleEditChange('customer_city', v)} />
														</label>
													</div>
												</div>

												<div className="om-section">
													<h3 className="om-section-title">{t('orders.assignmentStatus') || 'Assignment & Status'}</h3>
													<div className="om-form-grid">
														  <label>{t('orders.status') || 'Status'}
															<Select value={editData.status} onChange={(v) => handleEditChange('status', v)}>
																{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
															</Select>
														</label>
														{canAssignOrders && (
															<label>{t('orders.assignedTo') || 'Assigned to'}
																<Select value={editData.assigned_to ?? ''} onChange={(v) => handleEditChange('assigned_to', v || null)}>
																	<option value="">Unassigned</option>
																	{users.map(u => (
																		<option key={u.id} value={String(u.id)}>{u.first_name || ''} {u.last_name || ''} ({u.username})</option>
																	))}
																</Select>
															</label>
														)}
														  <label>{t('orders.notes') || 'Notes'}
															<TextInput value={editData.notes} onChange={(v) => handleEditChange('notes', v)} />
														</label>
													</div>
												</div>

												<div className="om-section">
													<h3 className="om-section-title">{t('orders.delivery') || 'Delivery'}</h3>
													<div className="om-form-grid">
														  <label>{t('delivery.wilaya') || 'Wilaya'}
															<Select value={editData.wilaya_id ?? ''} onChange={(v) => handleEditChange('wilaya_id', v)}>
																<option value="">{t('delivery.selectWilaya') || 'Select wilaya'}</option>
																{wilayas.map(w => (
																	<option key={w.id} value={String(w.id)}>{w.name_fr || w.name_en || w.name_ar} ({w.code})</option>
																))}
															</Select>
														</label>
														  <label>{t('delivery.baladia') || 'Baladia'}
															<Select value={editData.baladia_id ?? ''} onChange={(v) => handleEditChange('baladia_id', v)} disabled={!editData.wilaya_id || loadingBaladias}>
																<option value="">{t('delivery.selectBaladia') || 'Select baladia'}</option>
																{baladias.map(b => (
																	<option key={b.id} value={String(b.id)}>{b.name_fr || b.name_en || b.name_ar}</option>
																))}
															</Select>
														</label>
														  <label>{t('delivery.type') || 'Delivery type'}
															<Select value={editData.delivery_type || 'home'} onChange={(v) => handleEditChange('delivery_type', v)}>
																<option value="home">home</option>
																<option value="stop_desk">stop_desk</option>
																<option value="les_changes">les_changes</option>
															</Select>
														</label>
														{editData.delivery_type === 'stop_desk' && (
															<label>{t('ecotrack.station') || 'EcoTrack Station'}
																<Select value={editData.ecotrack_station_code ?? ''} onChange={(v) => handleEditChange('ecotrack_station_code', v)} disabled={loadingStations}>
																	<option value="">{t('ecotrack.selectStation') || 'Select station'}</option>
																	{ecotrackStations.map(s => (
																		<option key={s.code} value={s.code}>{s.name} ({s.code})</option>
																	))}
																</Select>
															</label>
														)}
														  <label>{t('delivery.weight') || 'Weight (kg)'}
															<input type="number" min="0" step="0.1" value={editData.weight} onChange={(e) => handleEditChange('weight', e.target.value)} />
														</label>
														  <label>{t('delivery.price') || 'Delivery price (DA)'}
															<div className="row">
																<TextInput value={editData.delivery_price} onChange={(v) => handleEditChange('delivery_price', v)} />
																<Button onClick={() => calculateEditDeliveryPrice()}>{t('common.recalculate') || 'Recalculate'}</Button>
															</div>
														</label>
														{/* Send to EcoTrack - only allowed if status is confirmed */}
														<label>{t('tracking.sendToEcotrack') || 'Send to EcoTrack'}
															<div className="row">
																<Select
																	value={editData.status === 'import_to_delivery_company' ? 'ecotrack' : ''}
																	onChange={(v) => handleEditChange('status', v === 'ecotrack' ? 'import_to_delivery_company' : editData.status)}
																	disabled={editData.status !== 'confirmed'}
																>
																	<option value="">{t('common.none') || 'None'}</option>
																	<option value="ecotrack">EcoTrack</option>
																</Select>
																<Button
																	onClick={() => {
																		if (editData.status !== 'confirmed') {
																			alert(t('orders.onlyConfirmedOrdersAllowed') || 'Only confirmed orders can be sent to delivery company')
																			return
																		}
																		handleEditChange('status', 'import_to_delivery_company');
																		handleSaveEdit();
																	}}
																	disabled={editLoading || editData.status !== 'confirmed'}
																>
																	{t('tracking.send') || 'Send'}
																</Button>
															</div>
														</label>
													</div>
												</div>

												<div className="om-section">
													<h3 className="om-section-title">{t('orders.totals') || 'Totals'}</h3>
													<div className="om-form-grid">
														  <label>{t('orders.unitPrice') || 'Unit price (DA)'}
															<TextInput value={editData.total_amount} onChange={(v) => handleEditChange('total_amount', v)} />
														</label>
														  <label>{t('orders.quantity') || 'Quantity'}
															<input type="number" min="1" step="1" value={editData.quantity} onChange={(e) => handleEditChange('quantity', e.target.value)} />
														</label>
																			<label>{t('orders.finalTotal') || 'Final total (DA)'}
																				<div className="row">
																					<input type="number" value={editData.final_total ?? ''} onChange={(e) => handleEditChange('final_total', e.target.value)} />
																				</div>
																			</label>
													</div>
												</div>

												<div className="om-section">
													<h3 className="om-section-title">{t('orders.product') || 'Product'}</h3>
													<div className="om-form-grid">
														  <label>{t('product.name') || 'Product name'}
											<div className="row">
												<TextInput value={editData.product_name || ''} onChange={(v) => handleEditChange('product_name', v)} placeholder={t('orders.enterProductName') || 'Product name'} />
												<Button onClick={matchProductByName} disabled={loadingProducts}>{t('common.match') || 'Match'}</Button>
											</div>
								            </label>
								            {selectedProduct && (
											  <label>{t('product.variant') || 'Variant'}
								                <Select value={variants.find(v => v.variant_name === editData.product_variant)?.id ?? ''} onChange={handleVariantSelect}>
								                  <option value="">No variant</option>
								                  {variants.map(v => (
								                    <option key={v.id} value={String(v.id)}>{v.variant_name}</option>
								                  ))}
								                </Select>
								              </label>
								            )}
											<label>{t('product.variantText') || 'Variant (text)'}
											<TextInput value={editData.product_variant || ''} onChange={(v) => handleEditChange('product_variant', v)} placeholder={t('orders.enterModel') || 'e.g. Color/Size'} />
								            </label>
										<label>{t('products.productLink') || t('product.link') || 'Product link'}
											<TextInput value={editData.product_link} onChange={(v) => handleEditChange('product_link', v)} placeholder={t('products.productLink') || 'https://...'} />
								            </label>
													</div>
												</div>
								</div>
								<div className="om-modal-footer">
							<Button onClick={handleCloseEdit} disabled={editLoading}>{t('common.cancel') || 'Cancel'}</Button>
							<Button onClick={handleSaveEdit} disabled={editLoading}>{editLoading ? (t('common.loading') || 'Saving…') : (t('common.save') || 'Save')}</Button>
								</div>
							</div>
						</div>
					)}
		</div>
	)
}

