<script>
  import { onMount } from 'svelte';
  import { api, labels, formatDate } from '$lib/api/index.js';
  import { showToast, selectedEvent, refreshAlerts } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let closures = [];
  let roads = [];
  let filterStatus = '';
  let filterType = '';

  let showModal = false;
  let formData = {
    road_id: '',
    event_id: '',
    closure_type: 'police',
    closure_reason: '',
    closed_by: '',
    start_time: '',
    detour_suggestion: '',
  };

  async function loadData() {
    loading = true;
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.closure_type = filterType;
      if ($selectedEvent?.id) params.event_id = $selectedEvent.id;
      const [closuresRes, roadsRes] = await Promise.all([
        api.closures.list(params),
        api.roads.list(),
      ]);
      closures = closuresRes.data || [];
      roads = roadsRes.data || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    formData = {
      road_id: '',
      event_id: $selectedEvent?.id || '',
      closure_type: 'police',
      closure_reason: '',
      closed_by: '',
      start_time: new Date().toISOString().slice(0, 16),
      detour_suggestion: '',
    };
    showModal = true;
  }

  async function handleSave() {
    if (!formData.road_id || !formData.closure_type || !formData.closure_reason) {
      showToast('请填写必填项：道路、封控类型、原因', 'warning');
      return;
    }
    try {
      await api.closures.create(formData);
      showToast('封控记录已创建，相关任务将自动标记需重新规划', 'success');
      showModal = false;
      refreshAlerts();
      loadData();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  async function handleLift(c) {
    if (!confirm(`确定解除此封控：${c.road_name}？`)) return;
    try {
      await api.closures.lift(c.id);
      showToast('封控已解除', 'success');
      loadData();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  $: $selectedEvent, loadData();
  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-4 gap-3">
    <div class="stat-card">
      <div class="stat-label">封控总数</div>
      <div class="stat-value">{closures.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">进行中封控</div>
      <div class="stat-value text-red-600">{closures.filter((c) => c.status === 'active').length}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">交警封控</div>
      <div class="stat-value">{closures.filter((c) => c.closure_type === 'police').length}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">已解除</div>
      <div class="stat-value text-green-600">{closures.filter((c) => c.status === 'lifted').length}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select class="select w-auto" bind:value={filterStatus} on:change={loadData}>
        <option value="">全部状态</option>
        <option value="active">进行中</option>
        <option value="lifted">已解除</option>
      </select>
      <select class="select w-auto" bind:value={filterType} on:change={loadData}>
        <option value="">全部类型</option>
        {#each Object.entries(labels.closureType) as [k, v]}
          <option value={k}>{v}</option>
        {/each}
      </select>
    </div>
    <button class="btn-danger" on:click={openCreate}>🚧 新增封控</button>
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if closures.length === 0}
    <EmptyState emptyText="暂无封控记录" />
  {:else}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>编码</th>
              <th>道路</th>
              <th>类型</th>
              <th>状态</th>
              <th>封控原因</th>
              <th>上报人</th>
              <th>开始时间</th>
              <th>建议绕行</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each closures as c}
              <tr class={c.status === 'active' ? 'bg-red-50/30' : ''}>
                <td class="font-mono text-xs">{c.closure_code}</td>
                <td>
                  <div class="font-medium">{c.road_name}</div>
                  <div class="text-xs text-gray-400">{c.road_code} · {labels.roadLevel[c.road_level]}</div>
                </td>
                <td>
                  <span class="badge {c.closure_type === 'police' ? 'badge-red' : 'badge-yellow'}">
                    {labels.closureType[c.closure_type]}
                  </span>
                </td>
                <td>
                  <span class="{c.status === 'active' ? 'badge-red' : 'badge-green'}">
                    {c.status === 'active' ? '🚧 进行中' : '✅ 已解除'}
                  </span>
                  {#if c.end_time && c.status === 'lifted'}
                    <div class="text-xs text-gray-400 mt-0.5">
                      {formatDate(c.end_time, 'MM-DD HH:mm')}
                    </div>
                  {/if}
                </td>
                <td>
                  <div class="text-sm max-w-xs">{c.closure_reason}</div>
                  {#if c.event_name}
                    <div class="text-xs text-gray-400 mt-1">关联事件：{c.event_name}</div>
                  {/if}
                </td>
                <td class="text-sm">{c.closed_by || '-'}</td>
                <td class="text-sm">{formatDate(c.start_time, 'MM-DD HH:mm')}</td>
                <td class="text-sm">{c.detour_suggestion || '-'}</td>
                <td>
                  <div class="flex items-center gap-1">
                    {#if c.status === 'active'}
                      <button
                        on:click={() => handleLift(c)}
                        class="px-2 py-1 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100"
                      >解除封控</button>
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

  <Modal title="🚧 新增道路封控" show={showModal} size="lg" on:close={() => showModal = false}>
    <div class="space-y-4">
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
        ⚠️ 创建封控后，系统将<strong>自动</strong>将该道路上的已分配任务标记为"需重新规划"，并产生封控预警。
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">选择道路 *</label>
          <select class="select" bind:value={formData.road_id}>
            <option value="">-- 请选择道路 --</option>
            {#each roads as r}
              <option value={r.id}>[{labels.roadLevel[r.road_level]}|P{r.priority}] {r.road_name} ({r.length_km}km)</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="label">封控类型 *</label>
          <select class="select" bind:value={formData.closure_type}>
            {#each Object.entries(labels.closureType) as [k, v]}
              <option value={k}>{v}</option>
            {/each}
          </select>
        </div>
      </div>
      <div>
        <label class="label">封控原因 *</label>
        <textarea
          class="input min-h-[80px]"
          bind:value={formData.closure_reason}
          placeholder="详细描述封控原因，如：发生多车追尾事故、道路结冰严重、路面塌陷施工等"
        ></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">上报单位/人员</label>
          <input class="input" bind:value={formData.closed_by} placeholder="例如：交警支队一大队" />
        </div>
        <div>
          <label class="label">开始时间</label>
          <input type="datetime-local" class="input" bind:value={formData.start_time} />
        </div>
      </div>
      <div>
        <label class="label">绕行建议</label>
        <textarea
          class="input min-h-[60px]"
          bind:value={formData.detour_suggestion}
          placeholder="建议车辆绕行的替代路线"
        ></textarea>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showModal = false}>取消</button>
      <button class="btn-danger" on:click={handleSave}>确认封控</button>
    </div>
  </Modal>
</div>
