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
	// New status options
	'wrong_number',
	'follow_later',
	'non_available',
	'order_later',
	// Tentative call statuses (as in original): 1 to 6
	'1_tent',
	'2_tent',
	'3_tent',
	'4_tent',
	'5_tent',
	'6_tent',
	'import_to_delivery_company',
]

// Helper to check if order is older than 7 days
function isOrderOlderThan7Days(createdAt) {
	if (!createdAt) return false
	const orderDate = new Date(createdAt)
	const currentDate = new Date()
	const diffTime = Math.abs(currentDate - orderDate)
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
	return diffDays > 7
}

// Helper to check if order is delayed (over 7 days)
function isOrderDelayed(createdAt) {
	if (!createdAt) return false
	const orderDate = new Date(createdAt)
	const currentDate = new Date()
	const diffTime = Math.abs(currentDate - orderDate)
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
	return diffDays > 7
}

// Helper to get status colors
function getStatusColor(status) {
	const colorMap = {
		pending: '#ffa940', // Orange
		confirmed: '#52c41a', // Green
		processing: '#1890ff', // Blue
		out_for_delivery: '#722ed1', // Purple
		delivered: '#389e0d', // Dark Green
		cancelled: '#ff4d4f', // Red
		returned: '#d46b08', // Dark Orange
		on_hold: '#faad14', // Gold
		// New status options
		wrong_number: '#ff7875', // Light Red
		follow_later: '#40a9ff', // Light Blue
		non_available: '#ff9c6e', // Light Orange
		order_later: '#73d13d', // Light Green
		'1_tent': '#b7eb8f',
		'2_tent': '#95de64',
		'3_tent': '#73d13d',
		'4_tent': '#52c41a',
		'5_tent': '#389e0d',
		'6_tent': '#237804',
		import_to_delivery_company: '#722ed1' // Purple
	}
	return colorMap[status] || '#000000'
}

// Helper to translate status values
function getStatusLabel(status, t) {
	const statusMap = {
		pending: t('orders.statuses.pending') || 'En Attente',
		confirmed: t('orders.statuses.confirmed') || 'Confirmé',
		processing: t('orders.statuses.processing') || 'En Traitement',
		out_for_delivery: t('orders.statuses.out_for_delivery') || 'En Livraison',
		delivered: t('orders.statuses.delivered') || 'Livré',
		cancelled: t('orders.statuses.cancelled') || 'Annulé',
		returned: t('orders.statuses.returned') || 'Retourné',
		on_hold: t('orders.statuses.on_hold') || 'En Attente',
		// New status options
		wrong_number: t('orders.statuses.wrong_number') || 'Mauvais Numéro',
		follow_later: t('orders.statuses.follow_later') || 'Suivre Plus Tard',
		non_available: t('orders.statuses.non_available') || 'Non Disponible',
		order_later: t('orders.statuses.order_later') || 'Commander Plus Tard',
		'1_tent': t('orders.statuses.1_tent') || '1 Tente',
		'2_tent': t('orders.statuses.2_tent') || '2 Tentes',
		'3_tent': t('orders.statuses.3_tent') || '3 Tentes',
		'4_tent': t('orders.statuses.4_tent') || '4 Tentes',
		'5_tent': t('orders.statuses.5_tent') || '5 Tentes',
		'6_tent': t('orders.statuses.6_tent') || '6 Tentes',
		import_to_delivery_company: t('orders.statuses.import_to_delivery_company') || 'Envoyé au Transporteur'
	}
	return statusMap[status] || status
}

// Helpers for boutique filtering and debugging
function extractProductNameFromDetails(pd) {
	if (!pd || typeof pd !== 'object') return null
	const name = (
		pd.name ||
		pd.product_name ||
		pd.productName ||
		(pd.product && pd.product.name) ||
		(pd.Product && pd.Product.name) ||
		pd.title ||
		pd.productTitle ||
		null
	)
	return name != null ? String(name) : null
}

function extractOrderProductName(order) {
	try {
		const pd = typeof order?.product_details === 'string'
			? JSON.parse(order.product_details)
			: order?.product_details
		return extractProductNameFromDetails(pd)
	} catch (_) {
		return null
	}
}

function normalizeName(name) {
	if (!name) return ''
	return String(name).toLowerCase().trim().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ')
}

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

// Ensure the URL has http/https scheme before opening
function ensureHttp(url) {
	if (!url || typeof url !== 'string') return ''
	const trimmed = url.trim()
	if (/^https?:\/\//i.test(trimmed)) return trimmed
	return 'https://' + trimmed
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
	assigningIds,
	statusUpdatingIds,
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
				<Select 
					value={order.status} 
					onChange={(val) => onStatusChange(order.id, val)}
					disabled={statusUpdatingIds.has(order.id)}
					style={{
						color: getStatusColor(order.status),
						fontWeight: 'bold',
						border: `2px solid ${getStatusColor(order.status)}`,
						borderRadius: '4px',
						padding: '2px 4px'
					}}
				>
					{statusUpdatingIds.has(order.id) ? (
						<option value={order.status}>{t?.('common.loading') || 'Loading...'}</option>
					) : (
						STATUS_OPTIONS.map((s) => (
							<option key={s} value={s} style={{ color: getStatusColor(s) }}>{getStatusLabel(s, t)}</option>
						))
					)}
				</Select>
			</td>
			<td>{order.total_amount || 0} DA</td>
			{canAssign && (
				<td>
					<Select
							value={order.assigned_to ?? ''}
						onChange={(val) => onAssign(order.id, val || null)}
						disabled={assigningIds.has(order.id)}
					>
						{assigningIds.has(order.id) ? (
							<option value={order.assigned_to ?? ''}>{t?.('common.loading') || 'Loading...'}</option>
						) : (
							<>
								<option value="">{t?.('orders.unassigned') || 'Unassigned'}</option>
								{users.map((u) => (
									<option key={u.id} value={u.id}>
										{u.first_name || ''} {u.last_name || ''} ({u.username})
									</option>
								))}
							</>
						)}
					</Select>
				</td>
			)}
			<td style={{ 
				color: isOrderOlderThan7Days(order.created_at) ? '#ff6b6b' : 'inherit',
				fontWeight: isOrderOlderThan7Days(order.created_at) ? 'bold' : 'normal'
			}} title={isOrderOlderThan7Days(order.created_at) ? 'Order is older than 7 days' : ''}>
				{new Date(order.created_at).toLocaleString()}
				{isOrderOlderThan7Days(order.created_at) && ' ⚠️'}
			</td>
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
	const canDistributeOrders = isAdmin

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
	const [distributionLoading, setDistributionLoading] = useState(false)

	// Loading states for individual actions
	const [assigningIds, setAssigningIds] = useState(new Set())
	const [statusUpdatingIds, setStatusUpdatingIds] = useState(new Set())
	const [bulkActionLoading, setBulkActionLoading] = useState(false)

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
	const [boutiqueFilter, setBoutiqueFilter] = useState('') // '' or location id as string
	const [searchText, setSearchText] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')

	// Debug: boutique filtering diagnostics
	const [debugBoutique, setDebugBoutique] = useState(false)

	// Tab state
	const [activeTab, setActiveTab] = useState('orders')

	// Boutiques (locations)
	const [locations, setLocations] = useState([])
	const [loadingLocations, setLoadingLocations] = useState(false)

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
		if (loadingProducts) return // Only prevent if already loading
		try {
			setLoadingProducts(true)
			const res = await stockService.getProducts({ limit: 1000 })
			const list = res?.products || res?.data || []
			console.log('📦 Products loaded:', list.length, 'products')
			setProducts(Array.isArray(list) ? list : [])
		} catch (e) {
			console.warn('Failed to load products', e)
		} finally {
			setLoadingProducts(false)
		}
	}, [loadingProducts])

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

	// Load boutiques (locations)
	const fetchLocations = useCallback(async () => {
		if (loadingLocations || locations.length) return
		try {
			setLoadingLocations(true)
			// Use stockService to fetch locations (same as legacy implementation)
			const data = await stockService.getLocations({ is_active: true })
			const list = data?.locations || data?.data || data || []
			setLocations(Array.isArray(list) ? list : [])
		} catch (e) {
			console.warn('Failed to load locations', e)
			setLocations([])
		} finally {
			setLoadingLocations(false)
		}
	}, [loadingLocations, locations.length])

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

	// Store all orders for client-side filtering
	const [allOrders, setAllOrders] = useState([])

	// Derived filtered orders using the same logic as the original version
	const derivedFilteredOrders = useMemo(() => {
		let filtered = Array.isArray(allOrders) ? [...allOrders] : []

		// Apply search filter (phone/name/order number)
		if (debouncedSearch && debouncedSearch.trim()) {
			const searchTerm = debouncedSearch.trim().toLowerCase()
			const onlyDigits = searchTerm.replace(/\D/g, '')
			const hasAtLeast8Digits = onlyDigits.length >= 8
			const looksOrderNumber = /^\s*[A-Za-z]*[-_]?[0-9]{3,}\s*$/.test(searchTerm)

			filtered = filtered.filter(order => {
				if (hasAtLeast8Digits && order.customer_phone && order.customer_phone.toLowerCase().includes(searchTerm)) {
					return true
				}
				if (looksOrderNumber && order.order_number && order.order_number.toLowerCase().includes(searchTerm)) {
					return true
				}
				if (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) {
					return true
				}
				return false
			})
		}

		// Status filter
		if (statusFilter) {
			filtered = filtered.filter(order => order.status === statusFilter)
		}

		// Assigned filter
		if (assignedFilter) {
			if (assignedFilter === 'null') {
				filtered = filtered.filter(order => !order.assigned_to)
			} else if (assignedFilter === 'not_null') {
				filtered = filtered.filter(order => !!order.assigned_to)
			} else {
				filtered = filtered.filter(order => String(order.assigned_to) === String(assignedFilter))
			}
		}

		// Boutique filter (same logic as original) with more robust product name extraction
		if (boutiqueFilter) {
			const productsList = Array.isArray(products) ? products : []
			const locationsList = Array.isArray(locations) ? locations : []

			filtered = filtered.filter(order => {
				// Parse product details consistently
				let productName = extractOrderProductName(order)

				if (!productName) {
					// No product details available
					return boutiqueFilter === 'no_match' ? true : boutiqueFilter === 'has_match' ? false : false
				}

				const orderProductName = String(productName).toLowerCase().trim()
				const normalizedOrderName = normalizeName(orderProductName)
				const normLen = normalizedOrderName.length

				// Find matched product in our products list
				let matchedProduct = null
				for (const p of productsList) {
					if (!p?.name) continue
					const dbName = String(p.name).toLowerCase().trim()
					const normalizedDbName = normalizeName(dbName)
					const dbLen = normalizedDbName.length
					// Guard against overly short fuzzy matches which cause random results
					const exactMatch = (dbName === orderProductName) || (normalizedDbName === normalizedOrderName)
					const allowFuzzy = normLen >= 4 && dbLen >= 4
					const fuzzyMatch = allowFuzzy && (
						dbName.includes(orderProductName) ||
						orderProductName.includes(dbName) ||
						normalizedDbName.includes(normalizedOrderName) ||
						normalizedOrderName.includes(normalizedDbName)
					)
					if (exactMatch || fuzzyMatch) {
						matchedProduct = p
						break
					}
				}

				if (!matchedProduct) {
					// No DB product match found
					return boutiqueFilter === 'no_match'
				}

				if (boutiqueFilter === 'has_match') return true
				// Specific boutique (location id)
				const locId = matchedProduct.location_id
				if (!locId) return false
				return String(locId) === String(boutiqueFilter)
			})
		}

		// Tab filter - filter by delay status
		if (activeTab === 'delayed') {
			filtered = filtered.filter(order => isOrderDelayed(order.created_at))
		} else if (activeTab === 'orders') {
			filtered = filtered.filter(order => !isOrderDelayed(order.created_at))
		}

		return filtered
	}, [allOrders, debouncedSearch, statusFilter, assignedFilter, boutiqueFilter, products, locations, activeTab])

	// Calculate tab counts from all orders (regardless of current filters)
	const tabCounts = useMemo(() => {
		const all = Array.isArray(allOrders) ? allOrders : []
		const regularOrders = all.filter(order => !isOrderDelayed(order.created_at))
		const delayedOrders = all.filter(order => isOrderDelayed(order.created_at))
		
		return {
			regular: regularOrders.length,
			delayed: delayedOrders.length
		}
	}, [allOrders])

	// Calculate statistics from filtered orders
	const calculateStatistics = () => {
		const stats = {
			total: derivedFilteredOrders.length,
			pending: 0,
			confirmed: 0,
			processing: 0,
			out_for_delivery: 0,
			delivered: 0,
			cancelled: 0,
			wrong_number: 0,
			follow_later: 0,
			non_available: 0,
			order_later: 0,
			totalAmount: 0,
			averageAmount: 0,
		}

		derivedFilteredOrders.forEach(order => {
			stats.totalAmount += parseFloat(order.total_amount || 0)
			
			switch(order.status) {
				case 'pending':
					stats.pending++
					break
				case 'confirmed':
					stats.confirmed++
					break
				case 'processing':
					stats.processing++
					break
				case 'out_for_delivery':
					stats.out_for_delivery++
					break
				case 'delivered':
					stats.delivered++
					break
				case 'cancelled':
					stats.cancelled++
					break
				case 'wrong_number':
					stats.wrong_number++
					break
				case 'follow_later':
					stats.follow_later++
					break
				case 'non_available':
					stats.non_available++
					break
				case 'order_later':
					stats.order_later++
					break
				default:
					break
			}
		})

		stats.averageAmount = stats.total > 0 ? stats.totalAmount / stats.total : 0

		return stats
	}

	const orderStats = calculateStatistics()

	// Build debug info for boutique filtering when enabled
	const boutiqueDebugInfo = useMemo(() => {
		if (!debugBoutique || !boutiqueFilter) return { total: 0, matched: 0, items: [] }
		const productsList = Array.isArray(products) ? products : []
		const items = []
		let matchedCount = 0
		for (let i = 0; i < Math.min(allOrders.length, 300); i++) {
			const order = allOrders[i]
			const rawName = extractOrderProductName(order)
			const orderName = rawName ? String(rawName).toLowerCase().trim() : ''
			const normOrder = normalizeName(orderName)
			let matchedProduct = null
			let reason = 'none'
			let normalizedDbName = ''
			for (const p of productsList) {
				if (!p?.name) continue
				const dbName = String(p.name).toLowerCase().trim()
				const normDb = normalizeName(dbName)
				const exact = dbName === orderName || normDb === normOrder
				const allowFuzzy = normOrder.length >= 4 && normDb.length >= 4
				const fuzzy = allowFuzzy && (dbName.includes(orderName) || orderName.includes(dbName) || normDb.includes(normOrder) || normOrder.includes(normDb))
				if (exact || fuzzy) { matchedProduct = p; reason = exact ? 'exact' : 'fuzzy'; normalizedDbName = normDb; break }
			}
			let passes = false
			let locId = matchedProduct?.location_id ?? null
			if (!rawName) {
				passes = boutiqueFilter === 'no_match'
				if (passes) matchedCount++
			} else if (!matchedProduct) {
				passes = boutiqueFilter === 'no_match'
				if (passes) matchedCount++
			} else if (boutiqueFilter === 'has_match') {
				passes = true; matchedCount++
			} else {
				passes = String(locId) === String(boutiqueFilter)
				if (passes) matchedCount++
			}
			items.push({
				id: order.id,
				order_number: order.order_number,
				rawName,
				normOrder,
				matchedProductId: matchedProduct?.id ?? null,
				matchedProductName: matchedProduct?.name ?? null,
				normalizedDbName,
				matchedLocationId: locId,
				boutiqueFilter,
				passes,
				reason,
			})
		}
		return { total: allOrders.length, matched: matchedCount, items }
	}, [debugBoutique, boutiqueFilter, allOrders, products])

	useEffect(() => {
		if (!debugBoutique || !boutiqueFilter) return
		console.group('🏪 Boutique Filter Debug')
		console.log('Filter:', boutiqueFilter)
		console.log('Orders total:', allOrders.length)
		console.log('Products loaded:', products.length)
		console.log('Locations loaded:', locations.length)
		console.log('Derived filtered:', derivedFilteredOrders.length)
		console.log('Sample debug items:', boutiqueDebugInfo.items.slice(0, 5))
		console.groupEnd()
	}, [debugBoutique, boutiqueFilter, allOrders.length, products.length, locations.length, derivedFilteredOrders.length, boutiqueDebugInfo.items])

	const fetchOrders = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			// Always fetch all orders for client-side filtering
			const params = { page: 1, limit: 10000, sort_by: 'created_at', sort_order: 'DESC' }
			// Keep server-side filters that don't conflict with client-side
			if (!debouncedSearch && !boutiqueFilter) {
				if (statusFilter) params.status = statusFilter
				if (assignedFilter && assignedFilter !== 'null' && assignedFilter !== 'not_null') {
					params.assigned_to = assignedFilter
				}
			}
			const res = await orderService.getOrders(params)
			const all = Array.isArray(res?.orders) ? res.orders : []
			setAllOrders(all)
			setSelectedIds(new Set())
		} catch (e) {
			setError(e?.response?.data?.error || e?.message || 'Failed to load orders')
		} finally {
			setLoading(false)
		}
	}, [statusFilter, assignedFilter, debouncedSearch, boutiqueFilter])

	// Client-side pagination of filtered results
	const paginatedOrders = useMemo(() => {
		const start = (page - 1) * limit
		const end = start + limit
		return derivedFilteredOrders.slice(start, end)
	}, [derivedFilteredOrders, page, limit])

	// Update pagination info when filtered results change
	useEffect(() => {
		const totalFiltered = derivedFilteredOrders.length
		const pages = Math.max(1, Math.ceil(totalFiltered / limit))
		setTotalPages(pages)
		setTotalItems(totalFiltered)
		if (page > pages) {
			setPage(1)
		}
	}, [derivedFilteredOrders.length, limit, page])

	// Use paginated orders for display
	useEffect(() => {
		setOrders(paginatedOrders)
	}, [paginatedOrders])

	// Initial load + whenever filters/pagination change
	useEffect(() => {
		fetchOrders()
	}, [fetchOrders])

	// Load users list once if permitted
	useEffect(() => {
		fetchUsersIfNeeded()
	}, [fetchUsersIfNeeded])

	// Load locations once
	useEffect(() => {
		fetchLocations()
	}, [fetchLocations])

	// Load products on component mount (needed for product link matching)
	useEffect(() => {
		if (!products.length && !loadingProducts) {
			fetchProducts()
		}
	}, [products.length, loadingProducts, fetchProducts])

	// Ensure we have products when Boutique filter is active
	useEffect(() => {
		if (boutiqueFilter && !products.length && !loadingProducts) {
			fetchProducts()
		}
	}, [boutiqueFilter, products.length, loadingProducts, fetchProducts])

	// Re-apply boutique filter as soon as products become available
	useEffect(() => {
		if (boutiqueFilter && products.length && !loadingProducts) {
			fetchOrders()
		}
	}, [products.length, loadingProducts])

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
		
		// Add to loading set
		setStatusUpdatingIds(prev => new Set([...prev, orderId]))
		
		try {
				// Optimistic update
				const current = orders.find(o => o.id === orderId)
				const oldStatus = current?.status
			setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
				await orderService.updateOrderStatus(orderId, newStatus)
				
				// Reduce stock quantity when order becomes confirmed and has matched product
				if (newStatus === 'confirmed' && oldStatus !== 'confirmed' && current) {
					try {
						const productName = extractOrderProductName(current)
						if (productName && products.length > 0) {
							const productsList = Array.isArray(products) ? products : []
							let matchedProduct = null
							for (const p of productsList) {
								if (!p?.name) continue
								const dbName = String(p.name).toLowerCase().trim()
								const orderName = String(productName).toLowerCase().trim()
								const normDb = normalizeName(dbName)
								const normOrder = normalizeName(orderName)
								const exact = dbName === orderName || normDb === normOrder
								const allowFuzzy = normOrder.length >= 4 && normDb.length >= 4
								const fuzzy = allowFuzzy && (dbName.includes(orderName) || orderName.includes(dbName) || normDb.includes(normOrder) || normOrder.includes(normDb))
								if (exact || fuzzy) {
									matchedProduct = p
									break
								}
							}
							if (matchedProduct) {
								const quantity = Number(current.quantity) || Number(current.quantity_ordered) || 1
								const locationId = matchedProduct.location_id || current.location_id || 1
								console.log('🔍 Stock reduction attempt:', {
									orderId,
									productId: matchedProduct.id,
									productName: matchedProduct.name,
									locationId,
									quantity,
									orderData: current
								})
								try {
									// Use stock adjustment API (decrease stock)
									await stockService.adjustStock({
										product_id: matchedProduct.id,
										location_id: locationId,
										adjustment_type: 'decrease',
										quantity: quantity,
										reason: 'Order confirmed',
										notes: `Order #${orderId} confirmed - automatic stock reduction`
									})
									console.log(`✅ Successfully reduced stock for product ${matchedProduct.name} by ${quantity} units`)
								} catch (stockError) {
									console.warn('❌ Failed to reduce stock:', stockError)
									// Don't block status update for stock reduction failure
								}
							} else {
								console.log('❌ No matched product found for stock reduction. Order product name:', productName)
							}
						}
					} catch (productMatchError) {
						console.warn('Failed to match product for stock reduction:', productMatchError)
					}
				}
				
				// Mirror to Google Sheets if applicable (non-blocking)
				if (current) updateOrderStatusInGoogleSheets(current, newStatus)
				// Success notification
				if (newStatus === 'import_to_delivery_company') {
					alert(t('orders.sentToDeliveryCompany') || 'Order sent to delivery company')
				} else {
					alert(t('orders.statusUpdated') || 'Status updated')
				}
		} catch (e) {
			// Revert by refetching minimal page
			await fetchOrders()
			alert('Failed to update status')
		} finally {
			// Remove from loading set
			setStatusUpdatingIds(prev => {
				const newSet = new Set([...prev])
				newSet.delete(orderId)
				return newSet
			})
		}
	}

	const handleAssign = async (orderId, userIdOrNull) => {
		// Add to loading set
		setAssigningIds(prev => new Set([...prev, orderId]))
		
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
		} finally {
			// Remove from loading set
			setAssigningIds(prev => {
				const newSet = new Set(prev)
				newSet.delete(orderId)
				return newSet
			})
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

				// Find external_link from matched product
				let externalLink = ''
				const productName = productDetails.name
				console.log('🔍 Product link debug:', {
					productName,
					productsCount: products.length,
					productDetails,
					sampleProducts: products.slice(0, 3).map(p => ({ id: p.id, name: p.name, external_link: p.external_link }))
				})
				if (productName && products.length > 0) {
					const matchedProduct = products.find(p => {
						if (!p?.name) return false
						const dbName = String(p.name).toLowerCase().trim()
						const orderName = String(productName).toLowerCase().trim()
						const matches = dbName === orderName || dbName.includes(orderName) || orderName.includes(dbName)
						console.log('🔍 Product matching:', { dbName, orderName, matches })
						return matches
					})
					if (matchedProduct?.external_link) {
						externalLink = matchedProduct.external_link
						console.log('🔗 Product link found:', {
							orderProduct: productName,
							matchedProduct: matchedProduct.name,
							externalLink
						})
					} else {
						console.log('🔗 No product link found for:', productName, 'Matched product:', matchedProduct?.name, 'Has external_link:', !!matchedProduct?.external_link)
					}
				} else {
					console.log('🔗 Cannot search for product link - productName:', productName, 'products count:', products.length)
				}

			setEditData({
				customer_name: order.customer_name || '',
				customer_phone: order.customer_phone || '',
				customer_address: order.customer_address || '',
				customer_city: order.customer_city || '',
				total_amount: order.total_amount ?? '',
						notes: order.notes || '',
						quantity: order.quantity ?? 1,
						final_total: order.final_total ?? Number(order.total_amount || 0) * Number(order.quantity || 1) + Number(order.delivery_price || 0),
				status: isOrderOlderThan7Days(order.created_at) && order.status === 'pending' ? 'order_later' : (order.status || 'pending'),
				assigned_to: order.assigned_to ?? '',
				wilaya_id: order.wilaya_id || '',
				baladia_id: order.baladia_id || '',
				delivery_type: order.delivery_type || 'home',
				delivery_price: order.delivery_price ?? '',
				weight: order.weight || 1,
						ecotrack_station_code: order.ecotrack_station_code || '',
						external_link: externalLink,
	          product_name: productDetails.name || '',
	          product_variant: productDetails.variant || productDetails.matched_variant_name || ''
			})
			
			// Show notification if order was automatically set to order_later
			if (isOrderOlderThan7Days(order.created_at) && order.status === 'pending') {
				console.log('📅 Order older than 7 days - status automatically set to "order_later"')
				// You could also show a toast notification here if you have a toast system
			}
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
						// Reset EcoTrack station when wilaya changes for stop_desk delivery
						if (next.delivery_type === 'stop_desk') {
							next.ecotrack_station_code = ''
						}
					}
					// Reset EcoTrack station when delivery type changes to stop_desk
					if (field === 'delivery_type') {
						if (value === 'stop_desk') {
							next.ecotrack_station_code = ''
						}
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
			if (editData.external_link && editData.external_link.trim()) {
				updatedPD.external_link = editData.external_link.trim()
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
				// Success notification
				if (payload.status && payload.status !== editOriginal.status) {
					if (payload.status === 'import_to_delivery_company') {
						alert(t('orders.sentToDeliveryCompany') || 'Order sent to delivery company')
					} else {
						alert(t('orders.statusUpdated') || 'Status updated')
					}
				} else {
					alert(t('common.saved') || 'Saved')
				}
				setEditOpen(false)
				setEditOriginal(null)
				setEditData({})
			} catch (e) {
				console.error('Save edit error:', e)
				alert(`Failed to save changes: ${e.message || e}`)
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
	}, [statusFilter, assignedFilter, debouncedSearch, limit, boutiqueFilter])

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
		setBulkActionLoading(true)
		try {
			for (const id of selectedIds) {
				await handleAssign(id, bulkAssignUserId)
			}
			await fetchOrders()
			clearSelection()
			setBulkAssignUserId('')
		} catch (_) {
			// per-item errors handled inside handleAssign
		} finally {
			setBulkActionLoading(false)
		}
	}

	const bulkUnassign = async () => {
		if (selectedIds.size === 0) {
			alert(t('orders.selectOrdersToUnassign') || 'Please select orders to unassign')
			return
		}
		setBulkActionLoading(true)
		try {
			let successCount = 0
			let errorCount = 0
			for (const id of selectedIds) {
				try {
					await handleAssign(id, null)
					successCount++
				} catch (error) {
					errorCount++
					console.error(`Failed to unassign order ${id}:`, error)
				}
			}
			if (successCount > 0) {
				alert(t('orders.bulkUnassignSuccess', { count: successCount }) || `Successfully unassigned ${successCount} orders`)
			}
			if (errorCount > 0) {
				alert(t('orders.bulkUnassignError', { count: errorCount }) || `Failed to unassign ${errorCount} orders`)
			}
			await fetchOrders()
			clearSelection()
		} catch (error) {
			alert(t('orders.bulkUnassignError') || 'Failed to perform bulk unassignment')
		} finally {
			setBulkActionLoading(false)
		}
	}

	const bulkSendToDeliveryCompany = async () => {
		setBulkActionLoading(true)
		try {
			let successCount = 0
			let failedCount = 0
			let skippedCount = 0
			const results = {
				success: [],
				failed: [],
				skipped: [],
				ecotrackCreated: [],
				ecotrackFailed: []
			}

			for (const id of selectedIds) {
				const o = orders.find(x => x.id === id)
				if (!o || o.status !== 'confirmed') { 
					skippedCount++
					results.skipped.push({ id, orderNumber: o?.order_number || `ID-${id}`, reason: o ? 'Not confirmed' : 'Order not found' })
					continue 
				}
				
				// Step 1: Create EcoTrack order first (POST method)
				let ecotrackSuccess = false
				let ecotrackError = null
				
				try {
					const ecotrackResponse = await fetch('/api/ecotrack/create-order', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${localStorage.getItem('token')}`
						},
						body: JSON.stringify({
							orderId: id,
							orderData: {
								order_id: id,
								customer_name: o.customer_name,
								customer_phone: o.customer_phone,
								customer_address: o.customer_address,
								customer_city: o.customer_city,
								total_amount: o.total_amount,
								delivery_type: o.delivery_type,
								delivery_price: o.delivery_price,
								weight: o.weight || o.product_weight || 1,
								wilaya_id: o.wilaya_id,
								baladia_id: o.baladia_id,
								ecotrack_station_code: o.ecotrack_station_code || o.station_code,
								// Add order number for better tracking
								order_number: o.order_number
							}
						})
					})
					
					if (!ecotrackResponse.ok) {
						// Try to get specific error message from response
						let specificError = `HTTP ${ecotrackResponse.status}: ${ecotrackResponse.statusText}`
						try {
							const errorData = await ecotrackResponse.json()
							if (errorData && errorData.error) {
								specificError = errorData.error
							} else if (errorData && errorData.message) {
								specificError = errorData.message
							}
						} catch (parseError) {
							// Keep the original HTTP error if we can't parse JSON
						}
						ecotrackError = specificError
						results.ecotrackFailed.push({ id, orderNumber: o.order_number, error: ecotrackError })
					} else {
						let ecotrackData
						try {
							ecotrackData = await ecotrackResponse.json()
						} catch (jsonError) {
							ecotrackError = 'Invalid JSON response from EcoTrack API'
							results.ecotrackFailed.push({ id, orderNumber: o.order_number, error: ecotrackError })
						}
						
						if (ecotrackData && ecotrackData.success) {
							ecotrackSuccess = true
							results.ecotrackCreated.push({ 
								id, 
								orderNumber: o.order_number, 
								ecotrackId: ecotrackData.data?.tracking_id || ecotrackData.data?.ecotrack_order_id || ecotrackData.data?.id || 'Unknown'
							})
						} else {
							ecotrackError = ecotrackData?.error || ecotrackData?.message || 'Failed to create EcoTrack order'
							results.ecotrackFailed.push({ id, orderNumber: o.order_number, error: ecotrackError })
						}
					}
				} catch (e) {
					ecotrackError = e.message || 'Network error creating EcoTrack order'
					results.ecotrackFailed.push({ id, orderNumber: o.order_number, error: ecotrackError })
				}
				
				// Step 2: Only count as success if EcoTrack order creation was successful
				if (ecotrackSuccess) {
					// Note: Backend automatically updates status to 'out_for_delivery' when EcoTrack order is created
					// No need to update status here as it would conflict with backend logic
					successCount++
					results.success.push({ id, orderNumber: o.order_number })
				} else {
					// EcoTrack order creation failed, count as failed
					failedCount++
					results.failed.push({ id, orderNumber: o.order_number, error: ecotrackError || 'EcoTrack order creation failed' })
				}
			}

			await fetchOrders()
			clearSelection()
			
			// Create detailed summary message with EcoTrack creation results
			let message = `📦 Bulk Send to Delivery Company Results:\n\n`
			message += `✅ Successfully sent: ${successCount} orders\n`
			message += `🚚 EcoTrack orders created: ${results.ecotrackCreated.length}\n`
			if (failedCount > 0) {
				message += `❌ Failed: ${failedCount} orders\n`
			}
			if (results.ecotrackFailed.length > 0) {
				message += `🚫 EcoTrack creation failed: ${results.ecotrackFailed.length} orders\n`
			}
			if (skippedCount > 0) {
				message += `⏭️ Skipped: ${skippedCount} orders (only confirmed orders allowed)\n`
			}
			
			if (results.ecotrackCreated.length > 0) {
				message += `\n✅ Successfully created EcoTrack orders for:\n`
				results.ecotrackCreated.forEach(item => {
					message += `- Order #${item.orderNumber}${item.ecotrackId ? ` (EcoTrack ID: ${item.ecotrackId})` : ''}\n`
				})
			}
			
			if (results.ecotrackFailed.length > 0) {
				message += `\n❌ EcoTrack creation failed for:\n`
				results.ecotrackFailed.forEach(item => {
					message += `- Order #${item.orderNumber}: ${item.error}\n`
				})
			}
			
			if (results.failed.length > 0) {
				message += `\n❌ Status update failed for:\n`
				results.failed.forEach(item => {
					message += `- Order #${item.orderNumber}: ${item.error}\n`
				})
			}
			
			if (results.skipped.length > 0) {
				message += `\n⏭️ Skipped orders:\n`
				results.skipped.forEach(item => {
					message += `- Order #${item.orderNumber}: ${item.reason}\n`
				})
			}
			
			alert(message)
			
		} catch (error) {
			await fetchOrders()
			alert(`Failed to process bulk operation: ${error.message || 'Unknown error'}`)
		} finally {
			setBulkActionLoading(false)
		}
	}

	const bulkDelete = async () => {
		if (!canDeleteOrders) return
		if (!window.confirm(t('orders.bulkDeleteConfirm', { count: selectedIds.size }) || t('common.confirmDelete') || 'Delete selected orders?')) return
		setBulkActionLoading(true)
		try {
			for (const id of selectedIds) {
				await orderService.deleteOrder(id)
			}
			await fetchOrders()
			clearSelection()
		} catch (_) {
			await fetchOrders()
			alert(t('orders.deleteError') || 'Failed to delete some orders')
		} finally {
			setBulkActionLoading(false)
		}
	}

	// Distribution helpers: offer three client-side algorithms similar to old interface
	const getActiveEmployees = useCallback(() => {
		// Prefer role === 'employee' and active users
		return (users || []).filter(u => (u.role === 'employee') && (u.is_active !== false))
	}, [users])

	const computeCurrentWorkload = useCallback((ordersList) => {
		const counts = new Map()
		for (const u of getActiveEmployees()) counts.set(u.id, 0)
		for (const o of ordersList || []) {
			if (o.assigned_to && (o.status === 'pending' || o.status === 'processing' || o.status === 'on_hold')) {
				counts.set(o.assigned_to, (counts.get(o.assigned_to) || 0) + 1)
			}
		}
		return counts
	}, [getActiveEmployees])

	const distributeClientSide = useCallback(async (algorithm = 'round_robin') => {
		if (!canDistributeOrders) return
		const employees = getActiveEmployees()
		if (!employees.length) {
			alert(t('orders.distributeError') || 'No active employees found')
			return
		}
		// Use all orders (not just filtered page)
		const unassigned = (allOrders || []).filter(o => !o.assigned_to && o.status === 'pending')
		if (!unassigned.length) {
			alert(t('orders.distributeSuccess', { count: 0 }) || 'No unassigned pending orders')
			return
		}
		try {
			setDistributionLoading(true)
			let success = 0
			let idx = 0
			let workload = computeCurrentWorkload(allOrders)
			const pickBalanced = () => {
				let bestUserId = null
				let bestCount = Infinity
				for (const u of employees) {
					const c = workload.get(u.id) ?? 0
					if (c < bestCount) { bestCount = c; bestUserId = u.id }
				}
				return bestUserId
			}
			for (const o of unassigned) {
				let targetUserId
				switch (algorithm) {
					case 'balanced':
						targetUserId = pickBalanced();
						break
					case 'performance_based':
						// Placeholder: without metrics, use balanced strategy
						targetUserId = pickBalanced();
						break
					case 'round_robin':
					default:
						targetUserId = employees[idx % employees.length].id
				}
				try {
					await handleAssign(o.id, targetUserId)
					success++
					// Update local workload to reflect assignment
					workload.set(targetUserId, (workload.get(targetUserId) || 0) + 1)
				} catch (e) {
					console.error('Failed to assign during distribution:', e)
				}
				idx++
			}
			alert(t('orders.distributeSuccess', { count: success }) || `Distributed ${success} orders`)
			await fetchOrders()
		} catch (e) {
			console.error('Distribution error:', e)
			alert(t('orders.distributeError') || 'Failed to distribute orders')
		} finally {
			setDistributionLoading(false)
		}
	}, [canDistributeOrders, getActiveEmployees, allOrders, computeCurrentWorkload, handleAssign, fetchOrders, t])

	const handleDistribute = async () => {
		// Keep original quick distribute calling backend for parity
		try {
			setDistributionLoading(true)
			const res = await orderService.distributeOrders()
			const count = res?.distributed ?? res?.count ?? res?.distributedCount ?? 0
			alert(t('orders.distributeSuccess', { count }) || `Distributed ${count} orders`)
			await fetchOrders()
		} catch (e) {
			console.error('Distribution error:', e)
			alert(t('orders.distributeError') || 'Failed to distribute orders')
		} finally {
			setDistributionLoading(false)
		}
	}

	const empty = !loading && orders.length === 0

	// Export current filtered orders (all pages) to Excel only
	const handleExportExcel = useCallback(async () => {
		try {
			// Use the filtered results for export instead of re-querying
			const data = derivedFilteredOrders
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
	}, [derivedFilteredOrders, t])

	const hasSelection = selectedIds.size > 0
	const allSelectedConfirmed = hasSelection && Array.from(selectedIds).every(id => {
		const o = orders.find(x => x.id === id)
		return o && o.status === 'confirmed'
	})

	// Helper: find boutique for an order by matching product name to products list
	const getOrderProductBoutique = useCallback((order) => {
		if (!order?.product_details || !products.length || !locations.length) return null
		try {
			const pd = typeof order.product_details === 'string' ? JSON.parse(order.product_details) : order.product_details
			const name = (pd?.name || '').toString().trim()
			if (!name) return null
			const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim()
			const target = norm(name)
			const matched = products.find(p => {
				const pname = (p.name || '').toString()
				if (!pname) return false
				const np = norm(pname)
				return np === target || np.includes(target) || target.includes(np)
			})
			if (matched?.location_id) {
				const loc = locations.find(l => String(l.id) === String(matched.location_id))
				return {
					productId: matched.id,
					productName: matched.name,
					locationId: matched.location_id,
					locationName: loc ? loc.name : `Location ${matched.location_id}`,
					location: loc || null
				}
			}
			return null
		} catch {
			return null
		}
	}, [products, locations])

	return (
		<div className={`om-wrap ${hasSelection ? 'has-bulkbar' : ''}`}>
			<h1 className="om-title">{t('orders.orderManagement') || 'Order Management'}</h1>

			{/* Tab Navigation */}
			<div className="om-tabs">
				<button 
					className={`om-tab ${activeTab === 'orders' ? 'active' : ''}`}
					onClick={() => setActiveTab('orders')}
				>
					{t('orders.orders') || 'Orders'} ({tabCounts.regular})
				</button>
				<button 
					className={`om-tab ${activeTab === 'delayed' ? 'active' : ''}`}
					onClick={() => setActiveTab('delayed')}
				>
					{t('orders.delayedOrders') || 'Delayed Orders'} ({tabCounts.delayed}) 
					</button>
			</div>

			{/* Statistics Section */}
			<div className="om-statistics">
				<div className="stats-row">
					<div className="stat-card stat-pending">
						<div className="stat-title">{t('orders.statistics.pending') || 'En Attente'}</div>
						<div className="stat-value">{orderStats.pending}</div>
					</div>
					<div className="stat-card stat-confirmed">
						<div className="stat-title">{t('orders.statistics.confirmed') || 'Confirmées'}</div>
						<div className="stat-value">{orderStats.confirmed}</div>
					</div>
					<div className="stat-card stat-processing">
						<div className="stat-title">{t('orders.statistics.processing') || 'En Traitement'}</div>
						<div className="stat-value">{orderStats.processing}</div>
					</div>
					<div className="stat-card stat-delivery">
						<div className="stat-title">{t('orders.statistics.outForDelivery') || 'En cours de livraison'}</div>
						<div className="stat-value">{orderStats.out_for_delivery}</div>
					</div>
					<div className="stat-card stat-delivered">
						<div className="stat-title">{t('orders.statistics.delivered') || 'Livrées'}</div>
						<div className="stat-value">{orderStats.delivered}</div>
					</div>
					<div className="stat-card stat-cancelled">
						<div className="stat-title">{t('orders.statistics.cancelled') || 'Annulées'}</div>
						<div className="stat-value">{orderStats.cancelled}</div>
					</div>
				</div>
			</div>

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
							<option key={s} value={s}>{getStatusLabel(s, t)}</option>
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

					<label>{t('orders.boutique') || 'Boutique'}</label>
					<Select value={boutiqueFilter} onChange={setBoutiqueFilter}>
						<option value="">{t('common.all') || 'All'}</option>
						<option value="has_match">{t('orders.hasMatch') || 'Has Match'}</option>
						<option value="no_match">{t('orders.noMatch') || 'No Match'}</option>
						{locations.map((loc) => (
							<option key={loc.id} value={String(loc.id)}>{loc.name}</option>
						))}
					</Select>

					<label>{t('common.pageSize') || 'Page size'}</label>
					<Select value={String(limit)} onChange={(v) => setLimit(Number(v))}>
						{[10, 20, 50, 100].map((n) => (
							<option key={n} value={String(n)}>{n}</option>
						))}
					</Select>

					<span style={{ marginLeft: 12 }} />
					<Button onClick={handleExportExcel}>{t('common.exportExcel') || 'Export Excel'}</Button>
					{canDistributeOrders && (
						<span style={{ display: 'inline-flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
							<Button onClick={() => distributeClientSide('round_robin')} disabled={distributionLoading}>
								{distributionLoading ? (t('common.loading') || 'Loading...') : (t('orders.distributeRoundRobin') || 'Round Robin')}
							</Button>
							<Button onClick={() => distributeClientSide('balanced')} disabled={distributionLoading}>
								{distributionLoading ? (t('common.loading') || 'Loading...') : (t('orders.distributeBalanced') || 'Balanced')}
							</Button>
							<Button onClick={() => distributeClientSide('performance_based')} disabled={distributionLoading}>
								{distributionLoading ? (t('common.loading') || 'Loading...') : (t('orders.distributePerformanceBased') || 'Performance-based')}
							</Button>
						</span>
					)}
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
								<Select 
									value={bulkAssignUserId} 
									onChange={setBulkAssignUserId} 
									style={{ maxWidth: 220 }}
									disabled={bulkActionLoading}
								>
									<option value="">{t('orders.selectUser') || 'Select user'}</option>
									{users.map(u => (
										<option key={u.id} value={String(u.id)}>{u.first_name || ''} {u.last_name || ''} ({u.username})</option>
									))}
								</Select>
								<Button onClick={bulkAssign} style={{ marginLeft: 6 }} disabled={bulkActionLoading}>
									{bulkActionLoading ? (t('common.loading') || 'Loading...') : (t('orders.apply') || 'Apply')}
								</Button>
								<Button onClick={bulkUnassign} style={{ marginLeft: 6 }} disabled={bulkActionLoading}>
									{bulkActionLoading ? (t('common.loading') || 'Loading...') : (t('orders.bulkUnassign') || 'Désassignation en Masse')}
								</Button>
							</span>
						)}
						<span style={{ marginLeft: 16 }}>
							<Button onClick={bulkSendToDeliveryCompany} disabled={!allSelectedConfirmed || bulkActionLoading}>
								{bulkActionLoading ? (t('common.loading') || 'Loading...') : (t('orders.sendToDeliveryCompany') || 'Send to Delivery Company')}
							</Button>
						</span>
						{canDeleteOrders && (
							<span style={{ marginLeft: 16 }}>
								<Button onClick={bulkDelete} disabled={bulkActionLoading}>
									{bulkActionLoading ? (t('common.loading') || 'Loading...') : (t('common.delete') || 'Delete')}
								</Button>
							</span>
						)}
					</div>
				)}
				{boutiqueFilter && (
					<div className="om-hint" style={{ margin: '8px 0', fontSize: 12, color: '#666' }}>
						{t('orders.filterByBoutique') || 'Filter by Boutique'}: {String(boutiqueFilter)} — {t('common.results') || 'results'}: {derivedFilteredOrders.length}
					</div>
				)}
				{debugBoutique && boutiqueFilter && (
					<details style={{ margin: '4px 0 10px' }} open>
						<summary style={{ cursor: 'pointer', fontSize: 12 }}>
							Debug details (showing up to {boutiqueDebugInfo.items.length} of {boutiqueDebugInfo.total}). Matched count: {boutiqueDebugInfo.matched}
						</summary>
						<div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #ddd', padding: 6 }}>
							<table style={{ width: '100%', borderCollapse: 'collapse' }}>
								<thead>
									<tr>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>ID</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Order #</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Name</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Norm Name</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Matched Product</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Matched Loc</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Passes</th>
										<th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Reason</th>
									</tr>
								</thead>
								<tbody>
									{boutiqueDebugInfo.items.slice(0, 50).map((it) => (
										<tr key={it.id}>
											<td>{it.id}</td>
											<td>{it.order_number}</td>
											<td className="truncate" title={it.rawName || ''}>{it.rawName || ''}</td>
											<td className="truncate" title={it.normOrder || ''}>{it.normOrder || ''}</td>
											<td className="truncate" title={it.matchedProductName || ''}>{it.matchedProductName || ''}</td>
											<td>{it.matchedLocationId ?? '-'}</td>
											<td style={{ color: it.passes ? 'green' : 'crimson' }}>{String(it.passes)}</td>
											<td>{it.reason}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</details>
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
							<th>{t('orders.createdAt') || 'Créé le'}</th>
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
								assigningIds={assigningIds}
								statusUpdatingIds={statusUpdatingIds}
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
																{STATUS_OPTIONS.map(s => <option key={s} value={s}>{getStatusLabel(s, t)}</option>)}
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
																	<option key={w.code} value={String(w.code)}>{w.nom} ({w.code})</option>
																))}
															</Select>
														</label>
														  <label>{t('delivery.baladia') || 'Baladia'}
															<Select value={editData.baladia_id ?? ''} onChange={(v) => handleEditChange('baladia_id', v)} disabled={!editData.wilaya_id || loadingBaladias}>
																<option value="">{t('delivery.selectBaladia') || 'Select baladia'}</option>
																{baladias.map(b => (
																	<option key={b.id || b.nom} value={String(b.id || b.nom)}>{b.nom || b.name_fr || b.name_en || b.name_ar}</option>
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
																	{(() => {
																		// Show all stations but prioritize matching ones first
																		const orderWilayaId = editData.wilaya_id
																		if (!orderWilayaId) {
																			// No wilaya selected, show all stations normally
																			return ecotrackStations.map(s => (
																				<option key={s.id} value={s.id}>{s.name} ({s.code})</option>
																			))
																		}
																		
																		// Convert wilaya ID to number for proper comparison
																		const orderWilayaIdNum = Number(orderWilayaId)
																		
																		// Get wilaya details for better matching
																		const currentWilaya = wilayas.find(w => Number(w.id) === orderWilayaIdNum)
																		const wilayaName = currentWilaya?.name_fr || currentWilaya?.name_en || currentWilaya?.name_ar || ''
																		const wilayaCode = currentWilaya?.code || ''
																		
																		// Separate stations into matching and non-matching
																		const matchingStations = []
																		const otherStations = []
																		
																		console.log('🔍 EcoTrack Station Filtering Debug:', {
																			orderWilayaId,
																			orderWilayaIdNum,
																			wilayaName,
																			wilayaCode,
																			totalStations: ecotrackStations.length
																		})
																		
																		ecotrackStations.forEach(station => {
																			// Multiple matching strategies
																			let isMatch = false
																			let matchReason = ''
																			
																			// Strategy 1: Station ID starts with wilaya code (padded to 2 digits)
																			const wilayaCodePadded = wilayaCode.toString().padStart(2, '0')
																			if (station.id && station.id.startsWith(wilayaCodePadded)) {
																				isMatch = true
																				matchReason = 'code_prefix'
																			}
																			
																			// Strategy 2: Station name contains wilaya name
																			if (!isMatch && wilayaName && station.name) {
																				const stationNameLower = station.name.toLowerCase()
																				const wilayaNameLower = wilayaName.toLowerCase()
																				if (stationNameLower.includes(wilayaNameLower) || wilayaNameLower.includes(stationNameLower)) {
																					isMatch = true
																					matchReason = 'name_match'
																				}
																			}
																			
																			// Strategy 3: Extract station wilaya ID from station ID (first 2 digits)
																			if (!isMatch && station.id && station.id.length >= 2) {
																				const stationWilayaCode = station.id.substring(0, 2)
																				if (stationWilayaCode === wilayaCodePadded) {
																					isMatch = true
																					matchReason = 'extracted_code'
																				}
																			}
																			
																			// Strategy 4: Check if station code matches wilaya code
																			if (!isMatch && station.code && wilayaCode) {
																				if (station.code.toString().startsWith(wilayaCode.toString())) {
																					isMatch = true
																					matchReason = 'station_code_match'
																				}
																			}
																			
																			if (isMatch) {
																				matchingStations.push({...station, matchReason})
																				console.log('✅ Station match:', station.name, station.id, matchReason)
																			} else {
																				otherStations.push(station)
																			}
																		})
																		
																		console.log(`📊 Filter results: ${matchingStations.length} matching, ${otherStations.length} other stations`)
																		
																		// Return matching stations first, then all others
																		return [
																			...matchingStations.map(s => (
																				<option key={s.id} value={s.id} style={{backgroundColor: '#e6f7ff', fontWeight: 'bold'}}>
																					🎯 {s.name} ({s.code || s.id})
																				</option>
																			)),
																			...otherStations.map(s => (
																				<option key={s.id} value={s.id}>{s.name} ({s.code || s.id})</option>
																			))
																		]
																	})()}
																</Select>
																{/* Show selected station info */}
																{editData.ecotrack_station_code && (() => {
																	const selectedStation = ecotrackStations.find(station => station.id === editData.ecotrack_station_code)
																	if (!selectedStation) return null
																	
																	return (
																		<div className="ecotrack-info">
																			<p><strong>{t('address') || 'Address'}:</strong> {selectedStation.address}</p>
																			{selectedStation.phones && Object.values(selectedStation.phones).filter(phone => phone).length > 0 && (
																				<p><strong>{t('phones') || 'Phones'}:</strong> {Object.values(selectedStation.phones).filter(phone => phone).join(', ')}</p>
																			)}
																			{selectedStation.map && (
																				<p><a href={selectedStation.map} target="_blank" rel="noopener noreferrer">{t('viewOnMap') || 'View on Map'}</a></p>
																			)}
																		</div>
																	)
																})()}
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
											<div className="row">
												<TextInput value={editData.external_link || ''} onChange={(v) => handleEditChange('external_link', v)} placeholder={t('products.productLink') || 'https://...'} />
												<Button
													onClick={() => {
														if (editData.external_link && editData.external_link.trim()) {
															const url = ensureHttp(editData.external_link)
															window.open(url, '_blank', 'noopener,noreferrer')
														} else {
															alert(t('products.noExternalLink') || 'No external link available')
														}
													}}
													disabled={!editData.external_link || !String(editData.external_link).trim()}
													className="ml-8"
												>
													{t('orders.openLink') || t('products.openExternalLink') || 'Open Link'}
												</Button>
											</div>
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

