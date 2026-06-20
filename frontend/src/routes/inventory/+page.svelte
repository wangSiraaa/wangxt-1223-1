<script>
  import { onMount } from 'svelte';
  import { api, labels, formatDate, formatNumber } from '$lib/api/index.js';
  import { showToast } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let transactions = [];
  let warehouses = [];
  let vehicles = [];
  let missions = [];
  let inventory = [];
  let total = 0;
  let page = 1;
  let pageSize = 50;
  let filterType = '';
  let filterWarehouse = '';

  let showOutboundModal = false;
  let outboundForm = {
    warehouse_id: '',
    vehicle_id: '',
    mission_id: '',
    salt_type: 'sodium_chloride',
    quantity_ton: '',
    operator: '',
    remark: '',
  };

  let showInboundModal = false;
  let inboundForm = {
    warehouse_id: '',
    salt_type: 'sodium_chloride',
    quantity_ton: '',
    supplier: '',
    operator: '',
    remark: '',
    unit_price: '',
  };

  async function loadData() {
    loading = true;
    try {
      const params = { page, pageSize };
      if (filterType) params.trans_type = filterType;
      if (filterWarehouse) params.warehouse_id = filterWarehouse;

      const [transRes, whRes, vehRes, misRes, invRes] = await Promise.all([
        api.warehouse.transactions(params),
        api.warehouse.warehouses(),
        api.vehicles.list(),
        api.missions.list({ pageSize: 200 }),
        api.warehouse.inventory(),
      ]);
      transactions = transRes.data?.list || transRes.data || [];
      total = transRes.data?.total || transactions.length;
      warehouses = whRes.data || [];
      vehicles = vehRes.data || [];
      missions = misRes.data?.list || misRes.data || [];
      inventory = invRes.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openOutbound(preselect = {}) {
    outboundForm = {
      warehouse_id: preselect.warehouse_id || warehouses[0]?.id || '',
      vehicle_id: preselect.vehicle_id || '',
      mission_id: preselect.mission_id || '',
      salt_type: 'sodium_chloride',
      quantity_ton: preselect.quantity_ton || '',
      operator: '',
      remark: '',
    };
    showOutboundModal = true;
  }

  $: if (showOutboundModal && outboundForm.mission_id) {
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
      showToast('出库登记成功', 'success');
      showOutboundModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '出库失败', 'error');
    }
  }

  function openInbound() {
    inboundForm = {
      warehouse_id: warehouses[0]?.id || '',
      salt_type: 'sodium_chloride',
      quantity_ton: '',
      supplier: '',
      operator: '',
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

  const invSummary = {
    total: inventory.reduce((a, b) => a + Number(b.quantity_ton || 0), 0),
    byType: inventory.reduce((acc, i) => {
      acc[i.salt_type] = (acc[i.salt_type] || 0) + Number(i.quantity_ton || 0);
      return acc;
    }, {}),
  };

  const statOutbound = transactions.filter((t) => t.trans_type === 'outbound');
  const statInbound = transactions.filter((t) => t.trans_type === 'inbound');
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOutbound = statOutbound.filter((t) => t.created_at?.startsWith(todayStr));
  const todayInbound = statInbound.filter((t) => t.created_at?.startsWith(todayStr));

  $: tasks = missions.filter((m) => m.status === 'assigned');

  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-5 gap-3">
    <div class="stat-card">
      <div class="stat-label">当前库存</div>
      <div class="stat-value">{formatNumber(invSummary.total, 1)}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
    </div>
    <div class="stat-card bg-gradient-to-br from-green-50 to-white">
      <div class="stat-label text-green-700">今日入库</div>
      <div class="stat-value text-green-600">
        +{formatNumber(todayInbound.reduce((a, b) => a + Math.abs(Number(b.quantity_ton || 0)), 0), 1)}
        <span class="text-base font-normal text-green-500 ml-1">t</span>
      </div>
    </div>
    <div class="stat-card bg-gradient-to-br from-red-50 to-white">
      <div class="stat-label text-red-700">今日出库</div>
      <div class="stat-value text-red-600">
        -{formatNumber(todayOutbound.reduce((a, b) => a + Math.abs(Number(b.quantity_ton || 0)), 0), 1)}
        <span class="text-base font-normal text-red-500 ml-1">t</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">总入库笔数</div>
      <div class="stat-value">{statInbound.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">总出库笔数</div>
      <div class="stat-value">{statOutbound.length}</div>
    </div>
  </div>

  <div class="card p-4">
    <h3 class="card-title mb-3">📦 库存概览</h3>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      {#each Object.entries(invSummary.byType) as [type, qty]}
        <div class="rounded-lg border border-gray-100 p-3 bg-gray-50/50">
          <div class="text-xs text-gray-500 mb-1">
            {type === 'sodium_chloride'
              ? '氯化钠'
              : type === 'calcium_chloride'
              ? '氯化钙'
              : '混合盐'}
          </div>
          <div class="text-xl font-bold text-gray-900">{formatNumber(qty, 1)} <span class="text-sm text-gray-500 font-normal">t</span></div>
        </div>
      {/each}
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select
        class="select w-auto"
        bind:value={filterType}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部类型</option>
        <option value="inbound">入库</option>
        <option value="outbound">出库</option>
        <option value="adjust">调整</option>
      </select>
      <select
        class="select w-auto"
        bind:value={filterWarehouse}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部仓库</option>
        {#each warehouses as w}
          <option value={w.id}>{w.warehouse_name}</option>
        {/each}
      </select>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-success" on:click={openInbound}>+ 📥 登记入库</button>
      <button class="btn-warning" on:click={() => openOutbound()}>- 📤 登记出库</button>
    </div>
  </div>

  <div class="card p-4 bg-yellow-50/50 border-yellow-200">
    <h4 class="font-semibold text-yellow-800 mb-3">🚛 待装盐车辆（已分配任务）</h4>
    {#if tasks.length === 0}
      <div class="text-sm text-yellow-600">暂无待装盐车辆</div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {#each tasks as t}
          <div class="bg-white rounded-lg p-3 border border-yellow-100 flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 text-sm font-medium">
                <span>🚛 {t.plate_number}</span>
              </div>
              <div class="text-xs text-gray-500 mt-0.5 truncate">
                📋 {t.mission_code} · 🛣️ {t.road_name}
              </div>
              <div class="text-xs text-yellow-700 mt-0.5">需盐 {formatNumber(t.allocated_salt_ton, 1)} t</div>
            </div>
            <button
              class="px-3 py-1.5 text-xs rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors shrink-0"
              on:click={() =>
                openOutbound({
                  vehicle_id: t.vehicle_id,
                  mission_id: t.id,
                  quantity_ton: t.allocated_salt_ton,
                })}
            >装车</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if transactions.length === 0}
    <EmptyState emptyText="暂无出入库记录" />
  {:else}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>流水号</th>
              <th>类型</th>
              <th>仓库</th>
              <th>盐类</th>
              <th>数量</th>
              <th>结存</th>
              <th>车辆/任务</th>
              <th>供应商/操作人</th>
              <th>备注</th>
              <th>时间</th>
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
                <td class="text-sm">
                  {t.salt_type === 'sodium_chloride'
                    ? '氯化钠'
                    : t.salt_type === 'calcium_chloride'
                    ? '氯化钙'
                    : t.salt_type === 'mixed_salt'
                    ? '混合盐'
                    : '-'}
                </td>
                <td
                  class="font-medium {t.trans_type === 'outbound'
                    ? 'text-red-600'
                    : t.trans_type === 'inbound'
                    ? 'text-green-600'
                    : 'text-gray-600'}"
                >
                  {t.trans_type === 'outbound' ? '-' : '+'}{formatNumber(Math.abs(t.quantity_ton || 0), 2)} t
                </td>
                <td class="text-sm">{t.balance_after ? formatNumber(t.balance_after, 2) + ' t' : '-'}</td>
                <td class="text-sm">
                  {#if t.plate_number}
                    <div>🚛 {t.plate_number}</div>
                  {/if}
                  {#if t.mission_code}
                    <div class="text-xs text-gray-500">{t.mission_code}</div>
                  {/if}
                  {#if !t.plate_number && !t.mission_code}-{/if}
                </td>
                <td class="text-sm">
                  {#if t.supplier}
                    <div>🏭 {t.supplier}</div>
                  {/if}
                  {#if t.operator}
                    <div class="text-xs text-gray-500">操作人: {t.operator}</div>
                  {/if}
                  {#if !t.supplier && !t.operator}
                    <div class="text-xs text-gray-500">{t.created_by_name || '-'}</div>
                  {/if}
                </td>
                <td class="text-sm text-gray-500 max-w-[120px] truncate" title={t.remark}>{t.remark || '-'}</td>
                <td class="text-xs text-gray-500">{formatDate(t.created_at, 'MM-DD HH:mm')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <Modal title="📤 登记出库（车辆装盐）" show={showOutboundModal} size="lg" on:close={() => showOutboundModal = false}>
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">出库仓库 *</label>
          <select class="select" bind:value={outboundForm.warehouse_id}>
            <option value="">-- 选择仓库 --</option>
            {#each warehouses as w}
              <option value={w.id}>{w.warehouse_name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">关联任务</label>
          <select class="select" bind:value={outboundForm.mission_id}>
            <option value="">-- 不关联 --</option>
            {#each missions.filter((m) => m.status === 'assigned') as m}
              <option value={m.id}>
                {m.mission_code} · {m.road_name} (需 {m.allocated_salt_ton}t)
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
                {v.plate_number} (当前 {formatNumber(v.current_salt_ton)}t / 最大 {v.salt_capacity_ton}t)
              </option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">盐类</label>
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
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">操作人</label>
          <input class="input" bind:value={outboundForm.operator} />
        </div>
        <div></div>
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

  <Modal title="📥 登记入库（融雪剂补给）" show={showInboundModal} size="lg" on:close={() => showInboundModal = false}>
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
          <label class="label">盐类</label>
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
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">供应商</label>
          <input class="input" bind:value={inboundForm.supplier} />
        </div>
        <div>
          <label class="label">操作人</label>
          <input class="input" bind:value={inboundForm.operator} />
        </div>
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
