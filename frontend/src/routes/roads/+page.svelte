<script>
  import { onMount } from 'svelte';
  import { api, labels, formatNumber } from '$lib/api/index.js';
  import { showToast, selectedEvent } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let roads = [];
  let filterLevel = '';
  let filterKey = '';
  let filterStatus = '';

  let showModal = false;
  let editingRoad = null;
  let formData = {
    road_code: '',
    road_name: '',
    road_level: 'main',
    length_km: 5,
    lanes: 4,
    salt_per_km: 0.5,
    priority: 3,
    is_key_route: false,
    start_point: '',
    end_point: '',
    status: 'normal',
  };

  async function loadData() {
    loading = true;
    try {
      const params = {};
      if (filterLevel) params.road_level = filterLevel;
      if (filterKey !== '') params.is_key_route = filterKey;
      if (filterStatus) params.status = filterStatus;
      const res = await api.roads.withMissions({
        ...params,
        event_id: $selectedEvent?.id || undefined,
      });
      roads = res.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  const roadLevelColors = {
    express: 'bg-red-500',
    main: 'bg-orange-500',
    secondary: 'bg-yellow-500',
    branch: 'bg-green-500',
  };

  function openCreate() {
    editingRoad = null;
    formData = {
      road_code: 'RD' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      road_name: '',
      road_level: 'main',
      length_km: 5,
      lanes: 4,
      salt_per_km: 0.5,
      priority: 3,
      is_key_route: false,
      start_point: '',
      end_point: '',
      status: 'normal',
    };
    showModal = true;
  }

  function openEdit(r) {
    editingRoad = r;
    formData = {
      road_code: r.road_code,
      road_name: r.road_name,
      road_level: r.road_level,
      length_km: r.length_km,
      lanes: r.lanes,
      salt_per_km: r.salt_per_km,
      priority: r.priority,
      is_key_route: r.is_key_route,
      start_point: r.start_point || '',
      end_point: r.end_point || '',
      status: r.status,
    };
    showModal = true;
  }

  async function handleSave() {
    if (!formData.road_code || !formData.road_name || !formData.road_level || !formData.length_km) {
      showToast('请填写必填项', 'warning');
      return;
    }
    try {
      if (editingRoad) {
        await api.roads.update(editingRoad.id, formData);
        showToast('道路更新成功', 'success');
      } else {
        await api.roads.create(formData);
        showToast('道路创建成功', 'success');
      }
      showModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  async function handleDelete(r) {
    if (!confirm(`确定删除道路：${r.road_name}？`)) return;
    try {
      await api.roads.remove(r.id);
      showToast('删除成功', 'success');
      loadData();
    } catch (e) {
      showToast(e.message || '删除失败', 'error');
    }
  }

  const totalKm = roads.reduce((a, b) => a + Number(b.length_km || 0), 0);
  const keyCount = roads.filter((r) => r.is_key_route).length;

  $: $selectedEvent, loadData();
  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-4 gap-3">
    <div class="stat-card">
      <div class="stat-label">道路总数</div>
      <div class="stat-value">{roads.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">重点道路</div>
      <div class="stat-value text-red-600">{keyCount}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">总里程</div>
      <div class="stat-value">{formatNumber(totalKm, 1)}<span class="text-base font-normal text-gray-500 ml-1">km</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">进行中作业</div>
      <div class="stat-value">{roads.filter((r) => r.status === 'processing').length}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select class="select w-auto" bind:value={filterLevel} on:change={loadData}>
        <option value="">全部等级</option>
        {#each Object.entries(labels.roadLevel) as [k, v]}
          <option value={k}>{v}</option>
        {/each}
      </select>
      <select class="select w-auto" bind:value={filterKey} on:change={loadData}>
        <option value="">全部</option>
        <option value="true">仅重点道路</option>
        <option value="false">非重点道路</option>
      </select>
      <select class="select w-auto" bind:value={filterStatus} on:change={loadData}>
        <option value="">全部状态</option>
        {#each Object.entries(labels.roadStatus) as [k, v]}
          <option value={k}>{v}</option>
        {/each}
      </select>
    </div>
    <button class="btn-primary" on:click={openCreate}>+ 新增道路</button>
  </div>

  <div class="flex flex-wrap gap-3 mb-2">
    {#each Object.entries(labels.roadLevel) as [k, v]}
      <div class="flex items-center gap-1.5 text-sm">
        <span class="w-3 h-3 rounded-full {roadLevelColors[k]}"></span>
        <span class="text-gray-600">{v}</span>
      </div>
    {/each}
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if roads.length === 0}
    <EmptyState emptyText="暂无道路数据" />
  {:else}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>编码</th>
              <th>道路名称</th>
              <th>等级</th>
              <th>里程</th>
              <th>车道</th>
              <th>用盐/km</th>
              <th>优先级</th>
              <th>作业车辆</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each roads as r}
              <tr>
                <td class="font-mono text-xs">{r.road_code}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full {roadLevelColors[r.road_level]} shrink-0"></span>
                    <span class="font-medium">
                      {r.road_name}
                      {#if r.is_key_route}
                        <span class="badge-red ml-1 text-[10px]">⭐重点</span>
                      {/if}
                    </span>
                  </div>
                  {#if r.start_point && r.end_point}
                    <div class="text-xs text-gray-400 mt-0.5">{r.start_point} → {r.end_point}</div>
                  {/if}
                </td>
                <td>
                  <span class="badge badge-blue">{labels.roadLevel[r.road_level]}</span>
                </td>
                <td>{formatNumber(r.length_km, 1)} km</td>
                <td>{r.lanes} 道</td>
                <td>{formatNumber(r.salt_per_km, 2)} t</td>
                <td>
                  <span
                    class="badge {r.priority <= 1
                      ? 'badge-red'
                      : r.priority === 2
                      ? 'badge-yellow'
                      : 'badge-gray'}"
                    >P{r.priority}</span
                  >
                </td>
                <td>
                  {#if r.active_mission_count > 0}
                    <span class="badge-green">{r.active_mission_count} 辆</span>
                    {#if r.assigned_vehicles}
                      <div class="text-xs text-gray-500 mt-0.5">{r.assigned_vehicles}</div>
                    {/if}
                  {:else if r.closure_count > 0}
                    <span class="badge-red">🚧 {r.closure_count}条封控</span>
                  {:else}
                    <span class="text-gray-400 text-xs">未派车</span>
                  {/if}
                </td>
                <td>
                  <span class="{
                    r.status === 'normal' ? 'badge-gray' :
                    r.status === 'closed' ? 'badge-red' :
                    r.status === 'processing' ? 'badge-yellow' : 'badge-green'
                  }">{labels.roadStatus[r.status]}</span>
                </td>
                <td>
                  <div class="flex items-center gap-1">
                    <button on:click={() => openEdit(r)} class="px-2 py-1 text-xs rounded bg-gray-50 text-gray-600 hover:bg-gray-100">编辑</button>
                    <button on:click={() => handleDelete(r)} class="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100">删除</button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <Modal title={editingRoad ? '编辑道路' : '新增道路'} show={showModal} size="lg" on:close={() => showModal = false}>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="label">道路编码 *</label>
        <input class="input" bind:value={formData.road_code} />
      </div>
      <div>
        <label class="label">道路名称 *</label>
        <input class="input" bind:value={formData.road_name} />
      </div>
      <div>
        <label class="label">道路等级 *</label>
        <select class="select" bind:value={formData.road_level}>
          {#each Object.entries(labels.roadLevel) as [k, v]}
            <option value={k}>{v}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="label">长度(km) *</label>
        <input type="number" step="0.1" min="0" class="input" bind:value={formData.length_km} />
      </div>
      <div>
        <label class="label">车道数</label>
        <input type="number" min="1" class="input" bind:value={formData.lanes} />
      </div>
      <div>
        <label class="label">融雪剂用量(吨/km)</label>
        <input type="number" step="0.01" min="0" class="input" bind:value={formData.salt_per_km} />
      </div>
      <div>
        <label class="label">优先级</label>
        <select class="select" bind:value={formData.priority}>
          {#each [1, 2, 3, 4, 5] as p}
            <option value={p}>P{p} {p === 1 ? '(最高)' : p === 5 ? '(最低)' : ''}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2 pt-6">
        <input type="checkbox" id="is_key" bind:checked={formData.is_key_route} class="w-4 h-4" />
        <label for="is_key" class="label mb-0">是重点道路 ⭐</label>
      </div>
      <div>
        <label class="label">起点</label>
        <input class="input" bind:value={formData.start_point} />
      </div>
      <div>
        <label class="label">终点</label>
        <input class="input" bind:value={formData.end_point} />
      </div>
      <div class="col-span-2">
        <label class="label">状态</label>
        <select class="select" bind:value={formData.status}>
          {#each Object.entries(labels.roadStatus) as [k, v]}
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
