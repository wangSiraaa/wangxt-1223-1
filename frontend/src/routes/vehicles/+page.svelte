<script>
  import { onMount } from 'svelte';
  import { api, labels, vehicleStatusColors, formatNumber } from '$lib/api/index.js';
  import { showToast } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let vehicles = [];
  let filterStatus = '';
  let filterTeam = '';

  let showModal = false;
  let editingVehicle = null;
  let formData = {
    plate_number: '',
    vehicle_type: '大型撒布车',
    salt_capacity_ton: 12,
    current_salt_ton: 0,
    driver_name: '',
    driver_phone: '',
    fleet_team: '第一车队',
    max_route_km: 40,
    current_location: '',
    status: 'idle',
  };

  async function loadData() {
    loading = true;
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterTeam) params.fleet_team = filterTeam;
      const res = await api.vehicles.list(params);
      vehicles = res.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editingVehicle = null;
    formData = {
      plate_number: '',
      vehicle_type: '大型撒布车',
      salt_capacity_ton: 12,
      current_salt_ton: 0,
      driver_name: '',
      driver_phone: '',
      fleet_team: '第一车队',
      max_route_km: 40,
      current_location: '',
      status: 'idle',
    };
    showModal = true;
  }

  function openEdit(v) {
    editingVehicle = v;
    formData = {
      plate_number: v.plate_number,
      vehicle_type: v.vehicle_type,
      salt_capacity_ton: v.salt_capacity_ton,
      current_salt_ton: v.current_salt_ton,
      driver_name: v.driver_name || '',
      driver_phone: v.driver_phone || '',
      fleet_team: v.fleet_team || '',
      max_route_km: v.max_route_km || '',
      current_location: v.current_location || '',
      status: v.status,
    };
    showModal = true;
  }

  async function handleSave() {
    if (!formData.plate_number || !formData.vehicle_type || !formData.salt_capacity_ton) {
      showToast('请填写必填项', 'warning');
      return;
    }
    try {
      if (editingVehicle) {
        await api.vehicles.update(editingVehicle.id, formData);
        showToast('车辆更新成功', 'success');
      } else {
        await api.vehicles.create(formData);
        showToast('车辆创建成功', 'success');
      }
      showModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  async function handleDelete(v) {
    if (!confirm(`确定删除车辆 ${v.plate_number}？`)) return;
    try {
      await api.vehicles.remove(v.id);
      showToast('删除成功', 'success');
      loadData();
    } catch (e) {
      showToast(e.message || '删除失败', 'error');
    }
  }

  const teams = [...new Set(vehicles.map((v) => v.fleet_team).filter(Boolean))];
  const saltSummary = {
    capacity: vehicles.reduce((a, b) => a + Number(b.salt_capacity_ton || 0), 0),
    current: vehicles.reduce((a, b) => a + Number(b.current_salt_ton || 0), 0),
  };

  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-4 gap-3">
    <div class="stat-card">
      <div class="stat-label">车辆总数</div>
      <div class="stat-value">{vehicles.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">当前总载盐</div>
      <div class="stat-value">{formatNumber(saltSummary.current, 1)}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">最大装载能力</div>
      <div class="stat-value">{formatNumber(saltSummary.capacity, 1)}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">载盐率</div>
      <div class="stat-value">
        {saltSummary.capacity > 0 ? Math.round((saltSummary.current / saltSummary.capacity) * 100) : 0}
        <span class="text-base font-normal text-gray-500 ml-1">%</span>
      </div>
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select class="select w-auto" bind:value={filterStatus} on:change={loadData}>
        <option value="">全部状态</option>
        {#each Object.entries(labels.vehicleStatus) as [k, v]}
          <option value={k}>{v}</option>
        {/each}
      </select>
      {#if teams.length > 0}
        <select class="select w-auto" bind:value={filterTeam} on:change={loadData}>
          <option value="">全部车队</option>
          {#each teams as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      {/if}
    </div>
    <button class="btn-primary" on:click={openCreate}>+ 新增车辆</button>
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if vehicles.length === 0}
    <EmptyState emptyText="暂无车辆信息" />
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each vehicles as v}
        <div class="card p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg">🚛</span>
                <span class="font-bold text-gray-900">{v.plate_number}</span>
              </div>
              <div class="text-xs text-gray-500">{v.vehicle_type}{v.fleet_team ? ` · ${v.fleet_team}` : ''}</div>
            </div>
            <span class="{vehicleStatusColors[v.status]}">{labels.vehicleStatus[v.status]}</span>
          </div>
          <div class="space-y-2 text-sm">
            <div>
              <div class="flex justify-between mb-1 text-xs text-gray-500">
                <span>载盐量</span>
                <span>{formatNumber(v.current_salt_ton)} / {formatNumber(v.salt_capacity_ton)} 吨</span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all {
                    v.current_salt_ton / v.salt_capacity_ton < 0.3
                      ? 'bg-red-400'
                      : v.current_salt_ton / v.salt_capacity_ton < 0.7
                      ? 'bg-yellow-400'
                      : 'bg-green-500'
                  }"
                  style="width: {Math.min(100, (v.current_salt_ton / v.salt_capacity_ton) * 100)}%"
                ></div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div class="text-xs text-gray-500">司机</div>
                <div class="text-gray-700">{v.driver_name || '-'}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">最大作业</div>
                <div class="text-gray-700">{v.max_route_km ? `${v.max_route_km} km` : '-'}</div>
              </div>
            </div>
            {#if v.current_location}
              <div>
                <div class="text-xs text-gray-500">当前位置</div>
                <div class="text-gray-700">{v.current_location}</div>
              </div>
            {/if}
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-1">
            <button on:click={() => openEdit(v)} class="px-2 py-1 text-xs rounded bg-gray-50 text-gray-600 hover:bg-gray-100">编辑</button>
            <button on:click={() => handleDelete(v)} class="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">删除</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <Modal title={editingVehicle ? '编辑车辆' : '新增车辆'} show={showModal} size="lg" on:close={() => showModal = false}>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label">车牌号 *</label>
        <input class="input" bind:value={formData.plate_number} placeholder="京A10001" />
      </div>
      <div>
        <label class="label">车辆类型 *</label>
        <select class="select" bind:value={formData.vehicle_type}>
          <option>大型撒布车</option>
          <option>中型撒布车</option>
          <option>小型撒布车</option>
          <option>铲雪车</option>
          <option>综合除雪车</option>
        </select>
      </div>
      <div>
        <label class="label">最大载盐量(吨) *</label>
        <input type="number" step="0.1" min="0" class="input" bind:value={formData.salt_capacity_ton} />
      </div>
      <div>
        <label class="label">当前载盐量(吨)</label>
        <input type="number" step="0.1" min="0" class="input" bind:value={formData.current_salt_ton} />
      </div>
      <div>
        <label class="label">司机姓名</label>
        <input class="input" bind:value={formData.driver_name} />
      </div>
      <div>
        <label class="label">司机电话</label>
        <input class="input" bind:value={formData.driver_phone} />
      </div>
      <div>
        <label class="label">所属车队</label>
        <select class="select" bind:value={formData.fleet_team}>
          <option value="">-- 未分配 --</option>
          <option>第一车队</option>
          <option>第二车队</option>
          <option>第三车队</option>
        </select>
      </div>
      <div>
        <label class="label">最大作业里程(km)</label>
        <input type="number" step="1" min="0" class="input" bind:value={formData.max_route_km} />
      </div>
      <div>
        <label class="label">当前位置</label>
        <input class="input" bind:value={formData.current_location} />
      </div>
      <div>
        <label class="label">状态</label>
        <select class="select" bind:value={formData.status}>
          {#each Object.entries(labels.vehicleStatus) as [k, v]}
            <option value={k}>{v}</option>
          {/each}
        </select>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showModal = false}>取消</button>
      <button class="btn-primary" on:click={handleSave}>保存</button>
    </div>
  </Modal>
</div>
