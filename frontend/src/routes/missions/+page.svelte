<script>
  import { onMount } from 'svelte';
  import { derived } from 'svelte/store';
  import {
    api,
    labels,
    missionStatusColors,
    formatDate,
    formatNumber,
  } from '$lib/api/index.js';
  import { selectedEvent, showToast, refreshAlerts } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let missions = [];
  let roads = [];
  let vehicles = [];
  let warehouses = [];
  let users = [];
  let total = 0;
  let page = 1;
  let pageSize = 50;

  let filterStatus = '';
  let filterRoad = '';
  let filterVehicle = '';

  let showCreateModal = false;
  let validateResult = null;
  let validating = false;
  let formData = {
    road_id: '',
    vehicle_id: '',
    warehouse_id: '',
    allocated_salt_ton: '',
    priority: 3,
    planned_start_time: '',
    remarks: '',
  };

  async function loadData() {
    loading = true;
    try {
      const params = { page, pageSize };
      if ($selectedEvent?.id) params.event_id = $selectedEvent.id;
      if (filterStatus) params.status = filterStatus;
      if (filterRoad) params.road_id = filterRoad;
      if (filterVehicle) params.vehicle_id = filterVehicle;

      const [missionsRes, roadsRes, vehiclesRes, warehousesRes, usersRes] = await Promise.all([
        api.missions.list(params),
        api.roads.withMissions({ event_id: $selectedEvent?.id || undefined }),
        api.vehicles.list(),
        api.warehouse.warehouses(),
        api.dashboard.users(),
      ]);

      missions = missionsRes.data?.list || missionsRes.data || [];
      total = missionsRes.data?.total || missions.length;
      roads = roadsRes.data || [];
      vehicles = vehiclesRes.data || [];
      warehouses = warehousesRes.data || [];
      users = usersRes.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  const idleVehicles = derived(
    () => vehicles.filter((v) => v.status === 'idle' || v.status === 'loading')
  );
  const availableRoads = derived(() =>
    roads.filter(
      (r) =>
        r.status !== 'closed' &&
        (!r.active_mission_count || r.closure_count > 0 ? false : true)
    )
  );

  function openCreate() {
    formData = {
      road_id: '',
      vehicle_id: '',
      warehouse_id: warehouses[0]?.id || '',
      allocated_salt_ton: '',
      priority: 3,
      planned_start_time: new Date().toISOString().slice(0, 16),
      remarks: '',
    };
    validateResult = null;
    showCreateModal = true;
  }

  $: if (formData.road_id && formData.vehicle_id) {
    validateMission();
  }

  async function validateMission() {
    if (!formData.road_id || !formData.vehicle_id) return;
    validating = true;
    try {
      const res = await api.missions.validate({
        road_id: formData.road_id,
        vehicle_id: formData.vehicle_id,
      });
      validateResult = res.data;
      if (res.data.valid) {
        formData.allocated_salt_ton = res.data.required_salt.toFixed(2);
      }
    } catch (e) {
      validateResult = {
        valid: false,
        error: e.message,
      };
    } finally {
      validating = false;
    }
  }

  async function handleCreate() {
    if (!formData.road_id || !formData.vehicle_id) {
      showToast('请选择道路和车辆', 'warning');
      return;
    }
    if (!validateResult?.valid) {
      if (validateResult?.road_closed) {
        showToast('道路已封控，请更换道路或解除封控', 'error');
        return;
      }
      if (!confirm('调度校验未通过，是否仍要创建任务？')) return;
    }
    try {
      await api.missions.create({
        ...formData,
        event_id: $selectedEvent?.id || null,
        allocated_salt_ton: Number(formData.allocated_salt_ton),
      });
      showToast('任务创建成功！请通知仓库装盐', 'success');
      showCreateModal = false;
      refreshAlerts();
      loadData();
    } catch (e) {
      showToast(e.message || '创建失败', 'error');
    }
  }

  async function handleStatusChange(mission, action) {
    try {
      if (action === 'start') {
        await api.missions.start(mission.id);
        showToast('任务已开始作业', 'success');
      } else if (action === 'complete') {
        const used = prompt(
          '请输入实际使用融雪剂（吨），默认使用分配量',
          mission.allocated_salt_ton
        );
        if (used === null) return;
        await api.missions.complete(mission.id, {
          used_salt_ton: Number(used) || mission.allocated_salt_ton,
        });
        showToast('任务已完成', 'success');
      } else if (action === 'cancel') {
        if (!confirm('确定取消此任务？')) return;
        await api.missions.cancel(mission.id);
        showToast('任务已取消', 'info');
      }
      loadData();
      refreshAlerts();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  onMount(loadData);
  $: $selectedEvent, loadData();
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select
        class="select w-auto"
        bind:value={filterStatus}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部状态</option>
        {#each Object.entries(labels.missionStatus) as [key, val]}
          <option value={key}>{val}</option>
        {/each}
      </select>
      <select
        class="select w-auto"
        bind:value={filterRoad}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部道路</option>
        {#each roads as r}
          <option value={r.id}>[{r.road_code}] {r.road_name}</option>
        {/each}
      </select>
      <select
        class="select w-auto"
        bind:value={filterVehicle}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部车辆</option>
        {#each vehicles as v}
          <option value={v.id}>{v.plate_number}</option>
        {/each}
      </select>
      <div class="text-sm text-gray-500">共 {total} 条</div>
    </div>
    <button class="btn-primary" on:click={openCreate}>
      <span class="mr-1">+</span> 分配新任务
    </button>
  </div>

  <div class="grid grid-cols-5 gap-3">
    <div class="card p-4">
      <div class="text-xs text-gray-500">总任务</div>
      <div class="text-2xl font-bold text-gray-900 mt-1">{total}</div>
    </div>
    {#each ['assigned', 'salt_loaded', 'in_progress', 'completed'] as status}
      <div class="card p-4">
        <div class="text-xs text-gray-500">{labels.missionStatus[status]}</div>
        <div class="text-2xl font-bold text-gray-900 mt-1">
          {missions.filter((m) => m.status === status).length}
        </div>
      </div>
    {/each}
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if missions.length === 0}
    <EmptyState emptyText="暂无任务，点击右上角分配新任务" />
  {:else}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>任务编码</th>
              <th>道路</th>
              <th>车辆</th>
              <th>融雪剂</th>
              <th>里程</th>
              <th>优先级</th>
              <th>状态</th>
              <th>分配时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each missions as m}
              <tr>
                <td class="font-mono text-xs">{m.mission_code}</td>
                <td>
                  <div class="flex items-center gap-2">
                    {#if m.is_key_route}
                      <span class="badge-red text-[10px]">重点</span>
                    {/if}
                    <span class="font-medium">{m.road_name}</span>
                  </div>
                  <div class="text-xs text-gray-400">
                    [{labels.roadLevel[m.road_level]}] {m.road_code}
                  </div>
                </td>
                <td>
                  <div class="font-medium">{m.plate_number}</div>
                  <div class="text-xs text-gray-400">{m.vehicle_type}</div>
                  <div class="text-xs text-gray-500">
                    载盐 {formatNumber(m.current_salt_ton)}/{formatNumber(m.salt_capacity_ton)}t
                  </div>
                </td>
                <td>
                  <div>分配 {formatNumber(m.allocated_salt_ton)}t</div>
                  {#if m.status === 'completed'}
                    <div class="text-xs text-green-600">
                      实际 {formatNumber(m.used_salt_ton)}t
                    </div>
                  {/if}
                </td>
                <td>{formatNumber(m.route_km, 1)} km</td>
                <td>
                  <span
                    class="badge {m.priority <= 1
                      ? 'badge-red'
                      : m.priority === 2
                      ? 'badge-yellow'
                      : 'badge-gray'}"
                    >P{m.priority}</span
                  >
                </td>
                <td>
                  <span class="{missionStatusColors[m.status]}">
                    {labels.missionStatus[m.status]}
                  </span>
                  {#if m.status === 'replan_required'}
                    <div class="text-xs text-red-500 mt-1">{m.replan_reason}</div>
                  {/if}
                </td>
                <td class="text-sm text-gray-500">{formatDate(m.assigned_time, 'MM-DD HH:mm')}</td>
                <td>
                  <div class="flex items-center gap-1 flex-wrap">
                    {#if m.status === 'salt_loaded'}
                      <button
                        on:click={() => handleStatusChange(m, 'start')}
                        class="px-2 py-1 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100"
                      >开始作业</button>
                    {/if}
                    {#if m.status === 'in_progress'}
                      <button
                        on:click={() => handleStatusChange(m, 'complete')}
                        class="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >完成</button>
                    {/if}
                    {#if ['assigned', 'salt_loaded', 'replan_required'].includes(m.status)}
                      <button
                        on:click={() => handleStatusChange(m, 'cancel')}
                        class="px-2 py-1 text-xs rounded bg-gray-50 text-gray-600 hover:bg-gray-100"
                      >取消</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <Modal
    title="分配新任务 · 智能调度校验"
    show={showCreateModal}
    size="lg"
    on:close={() => (showCreateModal = false)}
  >
    <div class="space-y-5">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">选择道路 <span class="text-red-500">*</span></label>
          <select class="select" bind:value={formData.road_id}>
            <option value="">-- 请选择道路 --</option>
            {#each roads as r}
              <option value={r.id} disabled={r.status === 'closed' || r.closure_count > 0}>
                [{labels.roadLevel[r.road_level]}|P{r.priority}] {r.road_name}
                {r.is_key_route ? ' ⭐重点' : ''} ({r.length_km}km)
                {r.status === 'closed' ? ' - 已封控' : r.closure_count > 0 ? ' - 有封控' : ''}
              </option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">选择车辆 <span class="text-red-500">*</span></label>
          <select class="select" bind:value={formData.vehicle_id}>
            <option value="">-- 请选择车辆 --</option>
            {#each vehicles as v}
              <option
                value={v.id}
                disabled={['working', 'maintenance'].includes(v.status)}
              >
                {v.plate_number} - {v.vehicle_type} (
                {labels.vehicleStatus[v.status]}：
                {formatNumber(v.current_salt_ton)}/{formatNumber(v.salt_capacity_ton)}t
                {v.max_route_km ? ` / 最大${v.max_route_km}km` : ''})
              </option>
            {/each}
          </select>
        </div>
      </div>

      {#if validateResult && !validating}
        <div
          class="rounded-lg p-4 border {validateResult.valid
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'}"
        >
          <div
            class="flex items-center gap-2 mb-2 font-medium {validateResult.valid
              ? 'text-green-700'
              : 'text-red-700'}"
          >
            {validateResult.valid ? '✅ 调度校验通过' : '❌ 调度校验未通过'}
          </div>

          {#if validateResult.road_closed}
            <div class="text-sm text-red-600 mb-1">
              🚧 该道路当前有 {validateResult.closures?.length} 条进行中的封控：
              <ul class="list-disc list-inside mt-1">
                {#each validateResult.closures as c}
                  <li>
                    <b>{labels.closureType[c.closure_type]}</b> 原因：{c.closure_reason}
                    {#if c.detour_suggestion}
                      ；建议绕行：{c.detour_suggestion}
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if validateResult.salt_check}
            <div
              class="text-sm {validateResult.salt_check.valid ? 'text-green-600' : 'text-red-600'} mb-1"
            >
              📦 载盐量检查：{validateResult.salt_check.valid ? '通过' : '未通过'} - 需
              {formatNumber(validateResult.required_salt, 2)} 吨，现有
              {formatNumber(validateResult.salt_check.available, 2)} 吨
              {#if !validateResult.salt_check.valid}
                ，缺 <b>{formatNumber(validateResult.required_salt - validateResult.salt_check.available, 2)}</b> 吨，
                <u>请先安排到仓库装盐！</u>
              {/if}
            </div>
          {/if}

          {#if validateResult.range_check && !validateResult.range_check.valid}
            <div class="text-sm text-red-600 mb-1">
              ⚠️ 作业里程：{validateResult.range_check.reason}
            </div>
          {/if}
        </div>
      {/if}

      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="label">分配仓库</label>
          <select class="select" bind:value={formData.warehouse_id}>
            <option value="">-- 暂不指定 --</option>
            {#each warehouses as w}
              <option value={w.id}>{w.warehouse_name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">融雪剂用量(吨)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            class="input"
            bind:value={formData.allocated_salt_ton}
            placeholder="自动计算"
          />
        </div>
        <div>
          <label class="label">优先级</label>
          <select class="select" bind:value={formData.priority}>
            {#each [1, 2, 3, 4, 5] as p}
              <option value={p}>P{p} {p <= 1 ? '(最高)' : p === 5 ? '(最低)' : ''}</option>
            {/each}
          </select>
        </div>
      </div>
      <div>
        <label class="label">计划开始时间</label>
        <input type="datetime-local" class="input" bind:value={formData.planned_start_time} />
      </div>
      <div>
        <label class="label">备注说明</label>
        <textarea
          class="input min-h-[60px]"
          bind:value={formData.remarks}
          placeholder="特殊作业要求、重点关注事项等"
        ></textarea>
      </div>
    </div>

    <div slot="footer" class="flex items-center justify-between">
      <div class="text-xs text-gray-500">
        💡 提示：系统会根据道路里程、车道数和单位用盐量自动计算所需融雪剂
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-secondary" on:click={() => (showCreateModal = false)}>取消</button>
        <button
          class="btn-primary"
          on:click={handleCreate}
          disabled={!formData.road_id || !formData.vehicle_id}
        >创建任务</button>
      </div>
    </div>
  </Modal>
</div>
