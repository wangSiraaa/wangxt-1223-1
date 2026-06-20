<script>
  import { onMount } from 'svelte';
  import { api, labels, formatNumber } from '$lib/api/index.js';
  import { showToast } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let warehouses = [];
  let inventory = [];
  let transactions = [];
  let activeTab = 'warehouses';

  let showWarehouseModal = false;
  let warehouseForm = {
    warehouse_code: '',
    warehouse_name: '',
    address: '',
    manager_name: '',
    manager_phone: '',
    capacity_ton: '',
  };

  let showOutboundModal = false;
  let outboundForm = {
    warehouse_id: '',
    vehicle_id: '',
    mission_id: '',
    salt_type: 'sodium_chloride',
    quantity_ton: '',
    remark: '',
  };

  let showInboundModal = false;
  let inboundForm = {
    warehouse_id: '',
    salt_type: 'sodium_chloride',
    quantity_ton: '',
    supplier: '',
    remark: '',
    unit_price: '',
  };

  let vehicles = [];
  let missions = [];

  async function loadData() {
    loading = true;
    try {
      const [whRes, invRes, transRes, vehRes, misRes] = await Promise.all([
        api.warehouse.warehouses(),
        api.warehouse.inventory(),
        api.warehouse.transactions({ pageSize: 50 }),
        api.vehicles.list(),
        api.missions.list({ pageSize: 200 }),
      ]);
      warehouses = whRes.data || [];
      inventory = invRes.data || [];
      transactions = transRes.data?.list || transRes.data || [];
      vehicles = vehRes.data || [];
      missions = misRes.data?.list || misRes.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openWarehouseModal() {
    warehouseForm = {
      warehouse_code: 'WH' + String(warehouses.length + 1).padStart(3, '0'),
      warehouse_name: '',
      address: '',
      manager_name: '',
      manager_phone: '',
      capacity_ton: '',
    };
    showWarehouseModal = true;
  }

  async function handleWarehouseSave() {
    if (!warehouseForm.warehouse_code || !warehouseForm.warehouse_name) {
      showToast('请填写仓库编码和名称', 'warning');
      return;
    }
    try {
      await api.warehouse.createWarehouse(warehouseForm);
      showToast('仓库创建成功', 'success');
      showWarehouseModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  function openOutboundModal() {
    outboundForm = {
      warehouse_id: warehouses[0]?.id || '',
      vehicle_id: '',
      mission_id: '',
      salt_type: 'sodium_chloride',
      quantity_ton: '',
      remark: '',
    };
    showOutboundModal = true;
  }

  $: if (outboundForm.mission_id) {
    const m = missions.find((x) => x.id === outboundForm.mission_id);
    if (m) {
      outboundForm.vehicle_id = m.vehicle_id;
      outboundForm.quantity_ton = m.allocated_salt_ton;
    }
  }

  async function handleOutbound() {
    if (!outboundForm.warehouse_id || !outboundForm.vehicle_id || !outboundForm.quantity_ton) {
      showToast('请填写仓库、车辆和出库数量', 'warning');
      return;
    }
    try {
      await api.warehouse.outbound({ ...outboundForm, quantity_ton: Number(outboundForm.quantity_ton) });
      showToast('出库登记成功，车辆载盐量已更新', 'success');
      showOutboundModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '出库失败', 'error');
    }
  }

  function openInboundModal() {
    inboundForm = {
      warehouse_id: warehouses[0]?.id || '',
      salt_type: 'sodium_chloride',
      quantity_ton: '',
      supplier: '',
      remark: '',
      unit_price: '',
    };
    showInboundModal = true;
  }

  async function handleInbound() {
    if (!inboundForm.warehouse_id || !inboundForm.quantity_ton) {
      showToast('请填写仓库和入库数量', 'warning');
      return;
    }
    try {
      await api.warehouse.inbound({ ...inboundForm, quantity_ton: Number(inboundForm.quantity_ton) });
      showToast('入库登记成功', 'success');
      showInboundModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '入库失败', 'error');
    }
  }

  function getInvByWarehouse(whId) {
    return inventory.filter((i) => i.warehouse_id === whId);
  }

  const totalInventory = inventory.reduce((a, b) => a + Number(b.quantity_ton || 0), 0);
  const totalCapacity = warehouses.reduce((a, b) => a + Number(b.capacity_ton || 0), 0);

  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-4 gap-3">
    <div class="stat-card">
      <div class="stat-label">仓库总数</div>
      <div class="stat-value">{warehouses.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">融雪剂总库存</div>
      <div class="stat-value">{formatNumber(totalInventory, 1)}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">总容量</div>
      <div class="stat-value">{formatNumber(totalCapacity, 0)}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">库位使用率</div>
      <div class="stat-value">{totalCapacity > 0 ? Math.round((totalInventory / totalCapacity) * 100) : 0}<span class="text-base font-normal text-gray-500 ml-1">%</span></div>
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
      {#each [
        { id: 'warehouses', label: '🏭 仓库' },
        { id: 'inventory', label: '📦 库存' },
        { id: 'transactions', label: '📋 流水' },
      ] as t}
        <button
          on:click={() => (activeTab = t.id)}
          class="px-4 py-2 rounded-md text-sm transition-colors {activeTab === t.id
            ? 'bg-white text-gray-900 shadow-sm font-medium'
            : 'text-gray-600 hover:text-gray-900'}"
        >{t.label}</button>
      {/each}
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-success" on:click={openInboundModal}>+ 入库</button>
      <button class="btn-warning" on:click={openOutboundModal}>- 出库</button>
      <button class="btn-secondary" on:click={openWarehouseModal}>+ 新建仓库</button>
    </div>
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if activeTab === 'warehouses'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each warehouses as wh}
        <div class="card p-5">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xl">🏭</span>
                <span class="font-bold text-gray-900">{wh.warehouse_name}</span>
              </div>
              <div class="text-xs text-gray-500">{wh.warehouse_code}</div>
            </div>
            {#if wh.capacity_ton && wh.total_inventory_ton}
              <span class="badge-blue">{Math.round((wh.total_inventory_ton / wh.capacity_ton) * 100)}%</span>
            {/if}
          </div>
          <div class="space-y-2 text-sm mb-4">
            {#if wh.address}
              <div>
                <span class="text-gray-500 text-xs">地址：</span>
                {wh.address}
              </div>
            {/if}
            {#if wh.manager_name}
              <div>
                <span class="text-gray-500 text-xs">管理员：</span>
                {wh.manager_name} {wh.manager_phone || ''}
              </div>
            {/if}
            <div class="pt-2 border-t border-gray-50 space-y-1">
              {#each getInvByWarehouse(wh.id) as inv}
                <div class="flex justify-between">
                  <span class="text-gray-600">
                    {inv.salt_type === 'sodium_chloride'
                      ? '氯化钠'
                      : inv.salt_type === 'calcium_chloride'
                      ? '氯化钙'
                      : '混合盐'}
                  </span>
                  <span class="font-medium">{formatNumber(inv.quantity_ton, 1)} t</span>
                </div>
                {#if wh.capacity_ton}
                  <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      class="h-full bg-blue-400"
                      style="width: {Math.min(100, (inv.quantity_ton / wh.capacity_ton) * 100)}%"
                    ></div>
                  </div>
                {/if}
              {:else}
                <div class="text-xs text-gray-400">暂无库存</div>
              {/each}
            </div>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>容量：{wh.capacity_ton || '-'} 吨</span>
            <span>库存：{formatNumber(wh.total_inventory_ton || 0, 1)} 吨</span>
          </div>
        </div>
      {/each}
    </div>
  {:else if activeTab === 'inventory'}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>仓库</th>
              <th>盐类型</th>
              <th>库存(吨)</th>
              <th>单价(元/吨)</th>
              <th>库存金额</th>
            </tr>
          </thead>
          <tbody>
            {#each inventory as inv}
              <tr>
                <td>
                  <div class="font-medium">{inv.warehouse_name}</div>
                  <div class="text-xs text-gray-400">{inv.warehouse_code}</div>
                </td>
                <td>
                  {inv.salt_type === 'sodium_chloride'
                    ? '氯化钠（工业盐）'
                    : inv.salt_type === 'calcium_chloride'
                    ? '氯化钙（环保型）'
                    : '混合盐'}
                </td>
                <td class="font-medium">{formatNumber(inv.quantity_ton, 2)}</td>
                <td>{inv.unit_price ? formatNumber(inv.unit_price, 2) : '-'}</td>
                <td>{inv.unit_price ? formatNumber(inv.quantity_ton * inv.unit_price, 2) + ' 元' : '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if activeTab === 'transactions'}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>流水号</th>
              <th>类型</th>
              <th>仓库</th>
              <th>数量</th>
              <th>结存</th>
              <th>关联任务</th>
              <th>车辆</th>
              <th>供应商</th>
              <th>操作时间</th>
            </tr>
          </thead>
          <tbody>
            {#each transactions as t}
              <tr>
                <td class="font-mono text-xs">{t.trans_code}</td>
                <td>
                  <span class="{t.trans_type === 'inbound' ? 'badge-green' : t.trans_type === 'outbound' ? 'badge-red' : 'badge-blue'}">
                    {labels.transType[t.trans_type]}
                  </span>
                </td>
                <td>{t.warehouse_name}</td>
                <td class="{t.trans_type === 'outbound' ? 'text-red-600' : 'text-green-600'} font-medium">
                  {t.trans_type === 'outbound' ? '-' : '+'}{formatNumber(Math.abs(t.quantity_ton), 2)} t
                </td>
                <td>{t.balance_after ? formatNumber(t.balance_after, 2) + ' t' : '-'}</td>
                <td>{t.mission_code || '-'}</td>
                <td>{t.plate_number || '-'}</td>
                <td>{t.supplier || '-'}</td>
                <td class="text-sm text-gray-500">{formatDate(t.created_at, 'MM-DD HH:mm')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <Modal title="新建仓库" show={showWarehouseModal} on:close={() => showWarehouseModal = false}>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label">仓库编码 *</label>
        <input class="input" bind:value={warehouseForm.warehouse_code} />
      </div>
      <div>
        <label class="label">仓库名称 *</label>
        <input class="input" bind:value={warehouseForm.warehouse_name} />
      </div>
      <div class="col-span-2">
        <label class="label">地址</label>
        <input class="input" bind:value={warehouseForm.address} />
      </div>
      <div>
        <label class="label">管理员</label>
        <input class="input" bind:value={warehouseForm.manager_name} />
      </div>
      <div>
        <label class="label">联系电话</label>
        <input class="input" bind:value={warehouseForm.manager_phone} />
      </div>
      <div>
        <label class="label">容量(吨)</label>
        <input type="number" step="1" min="0" class="input" bind:value={warehouseForm.capacity_ton} />
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showWarehouseModal = false}>取消</button>
      <button class="btn-primary" on:click={handleWarehouseSave}>保存</button>
    </div>
  </Modal>

  <Modal title="📤 融雪剂出库登记" show={showOutboundModal} size="lg" on:close={() => showOutboundModal = false}>
    <div class="space-y-4">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
        💡 出库后将自动更新车辆载盐量，如关联任务则任务状态变为"已装盐"
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">出库仓库 *</label>
          <select class="select" bind:value={outboundForm.warehouse_id}>
            <option value="">-- 选择仓库 --</option>
            {#each warehouses as w}
              <option value={w.id}>{w.warehouse_name} (库存 {formatNumber(w.total_inventory_ton || 0, 1)}吨)</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">关联任务</label>
          <select class="select" bind:value={outboundForm.mission_id}>
            <option value="">-- 不关联 --</option>
            {#each missions.filter((m) => m.status === 'assigned') as m}
              <option value={m.id}>
                {m.mission_code} · {m.road_name} → {m.plate_number} (需{m.allocated_salt_ton}t)
              </option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">领取车辆 *</label>
          <select class="select" bind:value={outboundForm.vehicle_id}>
            <option value="">-- 选择车辆 --</option>
            {#each vehicles.filter((v) => ['idle', 'loading'].includes(v.status)) as v}
              <option value={v.id}>
                {v.plate_number} ({v.vehicle_type}) 当前 {formatNumber(v.current_salt_ton)}t / 最大 {v.salt_capacity_ton}t
              </option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">盐类型</label>
          <select class="select" bind:value={outboundForm.salt_type}>
            <option value="sodium_chloride">氯化钠</option>
            <option value="calcium_chloride">氯化钙</option>
            <option value="mixed_salt">混合盐</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">出库数量(吨) *</label>
        <input type="number" step="0.01" min="0" class="input" bind:value={outboundForm.quantity_ton} />
      </div>
      <div>
        <label class="label">备注</label>
        <textarea class="input min-h-[60px]" bind:value={outboundForm.remark}></textarea>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showOutboundModal = false}>取消</button>
      <button class="btn-warning" on:click={handleOutbound}>确认出库</button>
    </div>
  </Modal>

  <Modal title="📥 融雪剂入库登记" show={showInboundModal} size="lg" on:close={() => showInboundModal = false}>
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">入库仓库 *</label>
          <select class="select" bind:value={inboundForm.warehouse_id}>
            <option value="">-- 选择仓库 --</option>
            {#each warehouses as w}
              <option value={w.id}>{w.warehouse_name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">盐类型</label>
          <select class="select" bind:value={inboundForm.salt_type}>
            <option value="sodium_chloride">氯化钠</option>
            <option value="calcium_chloride">氯化钙</option>
            <option value="mixed_salt">混合盐</option>
          </select>
        </div>
        <div>
          <label class="label">入库数量(吨) *</label>
          <input type="number" step="0.01" min="0" class="input" bind:value={inboundForm.quantity_ton} />
        </div>
        <div>
          <label class="label">单价(元/吨)</label>
          <input type="number" step="0.01" min="0" class="input" bind:value={inboundForm.unit_price} />
        </div>
      </div>
      <div>
        <label class="label">供应商</label>
        <input class="input" bind:value={inboundForm.supplier} placeholder="供货单位名称" />
      </div>
      <div>
        <label class="label">备注</label>
        <textarea class="input min-h-[60px]" bind:value={inboundForm.remark}></textarea>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showInboundModal = false}>取消</button>
      <button class="btn-success" on:click={handleInbound}>确认入库</button>
    </div>
  </Modal>
</div>
