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
  let closureImpact = null;
  let total = 0;
  let page = 1;
  let pageSize = 50;

  let filterStatus = '';
  let filterRoad = '';
  let filterVehicle = '';
  let filterAffected = '';

  let selectedMissions = new Set();
  let showImpactDetail = false;
  let showBatchReplanModal = false;

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
      if (filterAffected) params.affected_by_closure = filterAffected;

      const [missionsRes, roadsRes, vehiclesRes, warehousesRes, usersRes, impactRes] = await Promise.all([
        api.missions.list(params),
        api.roads.withMissions({ event_id: $selectedEvent?.id || undefined }),
        api.vehicles.list(),
        api.warehouse.warehouses(),
        api.dashboard.users(),
        api.closures.impactSummary({ event_id: $selectedEvent?.id || undefined }),
      ]);

      missions = missionsRes.data?.list || missionsRes.data || [];
      total = missionsRes.data?.total || missions.length;
      roads = roadsRes.data || [];
      vehicles = vehiclesRes.data || [];
      warehouses = warehousesRes.data || [];
      users = usersRes.data || [];
      closureImpact = impactRes.data || null;
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

  const affectedMissions = derived(() =>
    missions.filter((m) => m.status === 'replan_required' || m.has_active_closure)
  );

  const replanRequiredCount = derived(() =>
    missions.filter((m) => m.status === 'replan_required').length
  );
  const affectedCount = derived(() =>
    missions.filter((m) => m.has_active_closure && m.status !== 'replan_required').length
  );

  const allSelected = derived(() =>
    missions.length > 0 && missions.every((m) => canReplan(m) && selectedMissions.has(m.id))
  );
  const hasSelection = derived(() =>
    [...selectedMissions].some((id) => missions.find((m) => m.id === id && canReplan(m)))
  );

  function canReplan(m) {
    return ['assigned', 'salt_loaded', 'replan_required'].includes(m.status);
  }

  function toggleSelect(id) {
    if (selectedMissions.has(id)) {
      selectedMissions.delete(id);
    } else {
      selectedMissions.add(id);
    }
    selectedMissions = new Set(selectedMissions);
  }

  function toggleSelectAll() {
    if ($allSelected) {
      selectedMissions = new Set();
    } else {
      selectedMissions = new Set(missions.filter(canReplan).map((m) => m.id));
    }
  }

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
      } else if (action === 'replan') {
        await handleReplan(mission);
      }
      loadData();
      refreshAlerts();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  async function handleReplan(mission) {
    const reason = prompt(
      '请输入转待重规划的原因（不填则使用封控原因）',
      mission.replan_reason || ''
    );
    if (reason === null) return;
    try {
      await api.missions.replan(mission.id, { replan_reason: reason || undefined });
      showToast('任务已转为待重规划', 'success');
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  async function handleBatchReplan() {
    const ids = [...selectedMissions].filter((id) => {
      const m = missions.find((x) => x.id === id);
      return m && canReplan(m);
    });
    if (ids.length === 0) {
      showToast('请选择可转待重规划的任务', 'warning');
      return;
    }
    const reason = prompt(`共 ${ids.length} 条任务，输入统一的转重规划原因（可不填）`);
    if (reason === null) return;
    try {
      const res = await api.missions.batchReplan({
        mission_ids: ids,
        replan_reason: reason || undefined,
      });
      showToast(
        `批量处理完成：已转 ${res.data.updated_count} 条，跳过 ${res.data.skipped_count} 条`,
        'success'
      );
      selectedMissions = new Set();
      showBatchReplanModal = false;
      loadData();
      refreshAlerts();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  async function handleReplanAllFromBanner() {
    const ids = missions
      .filter((m) => m.has_active_closure && m.status !== 'replan_required' && canReplan(m))
      .map((m) => m.id);
    if (ids.length === 0) {
      showToast('没有可批量转换的任务', 'info');
      return;
    }
    if (!confirm(`检测到 ${ids.length} 条受封控影响但未转待重规划的任务，是否全部转为待重规划？`)) return;
    try {
      const res = await api.missions.batchReplan({ mission_ids: ids });
      showToast(
        `批量处理完成：已转 ${res.data.updated_count} 条，跳过 ${res.data.skipped_count} 条`,
        'success'
      );
      loadData();
      refreshAlerts();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  function getSelectedRoadClosures(roadId) {
    const road = roads.find((r) => r.id === roadId);
    return road?.active_closures || [];
  }

  onMount(loadData);
  $: $selectedEvent, loadData();
</script>

<div class="space-y-6">
  {#if closureImpact && closureImpact.total_active_closures > 0}
    <div class="card p-0 overflow-hidden border-red-200">
      <div class="bg-gradient-to-r from-red-50 to-orange-50 p-5 border-b border-red-100">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span class="text-2xl">🚧</span>
            </div>
            <div>
              <div class="text-lg font-bold text-red-800 flex items-center gap-2">
                封控路段预警 · 共 {closureImpact.total_active_closures} 条进行中封控
                {#if closureImpact.police_closure_count > 0}
                  <span class="badge badge-red text-xs">
                    其中交警封控 {closureImpact.police_closure_count} 条
                  </span>
                {/if}
              </div>
              <div class="text-sm text-red-600 mt-1">
                当前共有 <b>{closureImpact.total_affected_missions}</b> 条任务受封控影响
                {#if closureImpact.police_affected_missions > 0}
                  ，交警封控影响 <b>{closureImpact.police_affected_missions}</b> 条
                {/if}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              class="px-3 py-1.5 text-sm rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50"
              on:click={() => (showImpactDetail = !showImpactDetail)}
            >
              {showImpactDetail ? '收起详情' : '查看受封控明细'}
            </button>
            <button
              class="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              on:click={handleReplanAllFromBanner}
            >
              ⚡ 一键转受影响路线
            </button>
          </div>
        </div>
      </div>

      {#if showImpactDetail}
        <div class="px-5 py-4 bg-white divide-y divide-gray-100 max-h-[340px] overflow-auto">
          {#each closureImpact.active_closures as closure}
            <div class="py-3 first:pt-0 last:pb-0">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2 flex-1 min-w-0">
                  <span
                    class="badge {closure.closure_type === 'police' ? 'badge-red' : 'badge-yellow'} flex-shrink-0"
                  >
                    {labels.closureType[closure.closure_type]}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900">
                      {closure.is_key_route ? '⭐ ' : ''}{closure.road_name}
                      <span class="text-xs text-gray-400 ml-1">
                        [{labels.roadLevel[closure.road_level]}] {closure.road_code}
                      </span>
                    </div>
                    <div class="text-sm text-gray-600 mt-0.5 truncate">
                      原因：{closure.closure_reason}
                    </div>
                    {#if closure.detour_suggestion}
                      <div class="text-xs text-blue-600 mt-0.5">
                        💡 绕行建议：{closure.detour_suggestion}
                      </div>
                    {/if}
                    <div class="text-xs text-gray-400 mt-1">
                      {closure.closed_by || '未上报人'} · {formatDate(closure.start_time, 'MM-DD HH:mm')}
                    </div>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="text-lg font-bold text-red-600">
                    {closure.affected_mission_count || 0}
                    <span class="text-xs font-normal text-gray-500 ml-0.5">条受影响</span>
                  </div>
                  {#if closure.affected_missions && closure.affected_missions.length > 0}
                    <div class="text-xs text-gray-400 mt-0.5">
                      {closure.affected_missions
                        .slice(0, 3)
                        .map((m) => m.mission_code)
                        .join(' / ')}
                      {#if closure.affected_missions.length > 3}
                        等{closure.affected_missions.length}条
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

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
        bind:value={filterAffected}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部路线</option>
        <option value="true">🚧 仅看受封控影响</option>
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
      <div class="text-sm text-gray-500">
        共 {total} 条
        {#if $replanRequiredCount > 0 || $affectedCount > 0}
          <span class="ml-2">
            <span class="text-red-600 font-medium">需重规划 {$replanRequiredCount}</span>
            {#if $affectedCount > 0}
              <span class="mx-1 text-gray-300">|</span>
              <span class="text-orange-600">封控未转 {$affectedCount}</span>
            {/if}
          </span>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2">
      {#if $hasSelection}
        <button
          class="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
          on:click={() => (showBatchReplanModal = true)}
        >
          批量转待重规划（{[...selectedMissions].filter((id) => {
            const m = missions.find((x) => x.id === id);
            return m && canReplan(m);
          }).length}）
        </button>
      {/if}
      <button class="btn-primary" on:click={openCreate}>
        <span class="mr-1">+</span> 分配新任务
      </button>
    </div>
  </div>

  <div class="grid grid-cols-6 gap-3">
    <div class="card p-4">
      <div class="text-xs text-gray-500">总任务</div>
      <div class="text-2xl font-bold text-gray-900 mt-1">{total}</div>
    </div>
    {#each ['assigned', 'salt_loaded', 'in_progress', 'replan_required', 'completed'] as status}
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
              <th class="w-10">
                <input
                  type="checkbox"
                  class="scale-110"
                  checked={$allSelected}
                  on:change={toggleSelectAll}
                />
              </th>
              <th>任务编码</th>
              <th>道路 / 封控状态</th>
              <th>车辆</th>
              <th>融雪剂</th>
              <th>里程</th>
              <th>优先级</th>
              <th>状态 / 重规划原因</th>
              <th>分配时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each missions as m}
              <tr
                class={
                  (m.status === 'replan_required'
                    ? 'bg-red-50/40'
                    : m.has_active_closure
                    ? 'bg-orange-50/30'
                    : '')
                }
              >
                <td>
                  {#if canReplan(m)}
                    <input
                      type="checkbox"
                      class="scale-110"
                      checked={selectedMissions.has(m.id)}
                      on:change={() => toggleSelect(m.id)}
                    />
                  {/if}
                </td>
                <td class="font-mono text-xs">{m.mission_code}</td>
                <td>
                  <div class="flex items-center gap-2 flex-wrap">
                    {#if m.is_key_route}
                      <span class="badge-red text-[10px]">重点</span>
                    {/if}
                    {#if m.has_police_closure}
                      <span
                        class="badge badge-red text-[10px]"
                        title="受交警封控影响"
                      >🚓 交警封控</span>
                    {:else if m.has_active_closure}
                      <span
                        class="badge badge-yellow text-[10px]"
                        title="道路封控中"
                      >🚧 封控中</span>
                    {/if}
                    <span class="font-medium">{m.road_name}</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-0.5">
                    [{labels.roadLevel[m.road_level]}] {m.road_code}
                  </div>
                  {#if m.has_active_closure && m.road_closures && m.road_closures.length > 0}
                    <div class="mt-1 space-y-0.5">
                      {#each m.road_closures.slice(0, 2) as c}
                        <div
                          class="text-xs px-1.5 py-0.5 rounded inline-block {c.closure_type === 'police'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'}"
                        >
                          [{labels.closureType[c.closure_type]}] {c.closure_reason}
                          {#if c.detour_suggestion}
                            <span class="text-blue-600 ml-1">→{c.detour_suggestion}</span>
                          {/if}
                        </div>
                      {/each}
                      {#if m.road_closures.length > 2}
                        <div class="text-xs text-gray-400">
                          等共 {m.road_closures.length} 条封控
                        </div>
                      {/if}
                    </div>
                  {/if}
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
                  {#if m.status === 'replan_required' && m.replan_reason}
                    <div class="text-xs text-red-500 mt-1 max-w-[220px] truncate" title={m.replan_reason}>
                      {m.replan_reason}
                    </div>
                  {:else if m.has_active_closure && m.status !== 'replan_required' && m.status !== 'completed' && m.status !== 'in_progress'}
                    <div class="text-xs text-orange-600 mt-1">
                      ⚠️ 受封控影响，请尽快转重规划
                    </div>
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
                    {#if canReplan(m) && m.status !== 'replan_required' && m.has_active_closure}
                      <button
                        on:click={() => handleStatusChange(m, 'replan')}
                        class="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        title="转为待重规划状态"
                      >🔄 转待重规划</button>
                    {/if}
                    {#if m.status === 'replan_required'}
                      <button
                        on:click={() => handleStatusChange(m, 'replan')}
                        class="px-2 py-1 text-xs rounded bg-purple-50 text-purple-600 hover:bg-purple-100"
                        title="更新重规划原因"
                      >修改原因</button>
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
      {#if formData.road_id}
        {#each getSelectedRoadClosures(formData.road_id) as c}
          <div
            class="rounded-lg p-4 border-2 {c.closure_type === 'police'
              ? 'bg-red-50 border-red-300'
              : 'bg-yellow-50 border-yellow-300'}"
          >
            <div
              class="flex items-center gap-2 font-bold text-sm {c.closure_type === 'police'
                ? 'text-red-700'
                : 'text-yellow-700'}"
            >
              {c.closure_type === 'police' ? '🚓 交警封控警告' : '🚧 道路封控警告'}
              <span class="badge {c.closure_type === 'police' ? 'badge-red' : 'badge-yellow'} text-[10px]">
                {labels.closureType[c.closure_type]}
              </span>
            </div>
            <div class="mt-1 text-sm text-gray-700">
              <b>封控原因：</b>{c.closure_reason}
            </div>
            {#if c.detour_suggestion}
              <div class="mt-1 text-sm text-blue-700">
                💡 <b>绕行建议：</b>{c.detour_suggestion}
              </div>
            {/if}
            {#if c.closed_by}
              <div class="mt-1 text-xs text-gray-500">
                上报人：{c.closed_by} · {formatDate(c.start_time, 'MM-DD HH:mm')}
              </div>
            {/if}
            <div class="mt-2 p-2 rounded bg-white/60 text-xs font-bold text-red-600">
              ⚠️ 该道路当前无法正常作业，请更换其他道路，或确认封控解除后再分配
            </div>
          </div>
        {/each}
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">选择道路 <span class="text-red-500">*</span></label>
          <select class="select" bind:value={formData.road_id}>
            <option value="">-- 请选择道路 --</option>
            {#each roads as r}
              {#if r.closure_count > 0}
                <optgroup label="🚧 以下道路有封控">
              {/if}
              <option value={r.id} disabled={r.status === 'closed'}>
                [{labels.roadLevel[r.road_level]}|P{r.priority}] {r.road_name}
                {r.is_key_route ? ' ⭐重点' : ''} ({r.length_km}km)
                {r.status === 'closed' ? ' - [已封控]' : r.closure_count > 0 ? ` - [${r.closure_count}条封控]` : ''}
              </option>
              {#if r.closure_count > 0}
                </optgroup>
              {/if}
            {/each}
          </select>
          {#if formData.road_id}
            {#if roads.find((r) => r.id === formData.road_id)?.closure_count > 0}
              <div class="text-xs text-red-600 mt-1">
                ⚠️ 您选择的道路当前处于封控状态
              </div>
            {/if}
          {/if}
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
          disabled={!formData.road_id || !formData.vehicle_id || validateResult?.road_closed}
        >创建任务</button>
      </div>
    </div>
  </Modal>

  <Modal
    title="批量转为待重规划"
    show={showBatchReplanModal}
    size="md"
    on:close={() => (showBatchReplanModal = false)}
  >
    <div class="space-y-4">
      <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div class="text-sm font-medium text-yellow-800 mb-2">
          已选择 {[...selectedMissions].filter((id) => {
            const m = missions.find((x) => x.id === id);
            return m && canReplan(m);
          }).length} 条任务将转为待重规划
        </div>
        <ul class="text-xs text-yellow-700 space-y-0.5 max-h-40 overflow-auto list-disc list-inside">
          {#each [...selectedMissions] as id}
            {@const m = missions.find((x) => x.id === id)}
            {#if m && canReplan(m)}
              <li>
                <b>{m.mission_code}</b> · {m.road_name} / {m.plate_number}
                <span class="text-gray-500">（当前：{labels.missionStatus[m.status]}）</span>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
      <div class="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
        <div>📌 <b>操作说明：</b></div>
        <div>1. 转为待重规划后，车辆将被释放，可重新分配其他路线</div>
        <div>2. 系统将自动产生封控预警并推送至指挥中心</div>
        <div>3. 已完成或作业中的任务将被自动跳过</div>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => (showBatchReplanModal = false)}>取消</button>
      <button class="btn-danger" on:click={handleBatchReplan}>确认批量转待重规划</button>
    </div>
  </Modal>
</div>
