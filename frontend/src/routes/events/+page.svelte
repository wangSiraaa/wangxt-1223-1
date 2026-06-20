<script>
  import { onMount } from 'svelte';
  import { api, labels, formatDate } from '$lib/api/index.js';
  import { showToast, selectedEvent, refreshAlerts } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let events = [];
  let total = 0;
  let page = 1;
  let pageSize = 20;
  let filterStatus = '';

  let showCreateModal = false;
  let editingEvent = null;
  let formData = {
    event_name: '',
    snow_level: 'moderate',
    start_time: '',
    end_time: '',
    affected_areas: '',
    description: '',
    status: 'active',
  };

  async function loadData() {
    loading = true;
    try {
      const params = { page, pageSize };
      if (filterStatus) params.status = filterStatus;
      const res = await api.events.list(params);
      events = res.data?.list || res.data || [];
      total = res.data?.total || events.length;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editingEvent = null;
    formData = {
      event_name: '',
      snow_level: 'moderate',
      start_time: new Date().toISOString().slice(0, 16),
      end_time: '',
      affected_areas: '',
      description: '',
      status: 'active',
    };
    showCreateModal = true;
  }

  function openEdit(ev) {
    editingEvent = ev;
    formData = {
      event_name: ev.event_name,
      snow_level: ev.snow_level,
      start_time: ev.start_time ? ev.start_time.slice(0, 16) : '',
      end_time: ev.end_time ? ev.end_time.slice(0, 16) : '',
      affected_areas: ev.affected_areas || '',
      description: ev.description || '',
      status: ev.status,
    };
    showCreateModal = true;
  }

  async function handleSave() {
    if (!formData.event_name || !formData.snow_level || !formData.start_time) {
      showToast('请填写必填项：事件名称、降雪等级、开始时间', 'warning');
      return;
    }
    try {
      if (editingEvent) {
        await api.events.update(editingEvent.id, formData);
        showToast('降雪事件更新成功', 'success');
      } else {
        await api.events.create(formData);
        showToast('降雪事件创建成功，已自动扫描重点道路', 'success');
        refreshAlerts();
      }
      showCreateModal = false;
      loadData();
    } catch (e) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  async function handleDelete(ev) {
    if (!confirm(`确定删除降雪事件：${ev.event_name}？`)) return;
    try {
      await api.events.remove(ev.id);
      showToast('删除成功', 'success');
      loadData();
    } catch (e) {
      showToast(e.message || '删除失败', 'error');
    }
  }

  function setCurrentEvent(ev) {
    $selectedEvent = ev;
    showToast(`已切换当前事件：${ev.event_name}`, 'info');
    refreshAlerts();
  }

  function snowLevelClass(level) {
    return {
      light: 'badge-blue',
      moderate: 'badge-yellow',
      heavy: 'badge-red',
      blizzard: 'badge-red',
    }[level] || 'badge-gray';
  }

  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select class="select w-auto" bind:value={filterStatus} on:change={() => { page = 1; loadData(); }}>
        <option value="">全部状态</option>
        {#each Object.entries(labels.eventStatus) as [key, val]}
          <option value={key}>{val}</option>
        {/each}
      </select>
      <div class="text-sm text-gray-500">共 {total} 条记录</div>
    </div>
    <button class="btn-primary" on:click={openCreate}>
      <span class="mr-1">+</span> 新建降雪事件
    </button>
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if events.length === 0}
    <EmptyState emptyText="暂无降雪事件，点击右上角新建" />
  {:else}
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>事件编码</th>
              <th>事件名称</th>
              <th>降雪等级</th>
              <th>状态</th>
              <th>影响区域</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each events as ev}
              <tr class="{$selectedEvent?.id === ev.id ? 'bg-primary-50' : ''}">
                <td class="font-mono text-xs">{ev.event_code}</td>
                <td>
                  <div class="font-medium">{ev.event_name}</div>
                  {#if ev.description}
                    <div class="text-xs text-gray-400 truncate max-w-xs">{ev.description}</div>
                  {/if}
                </td>
                <td>
                  <span class="{snowLevelClass(ev.snow_level)}">{labels.snowLevel[ev.snow_level]}</span>
                </td>
                <td>
                  <span class="{
                    ev.status === 'active' ? 'badge-red' :
                    ev.status === 'monitoring' ? 'badge-yellow' :
                    ev.status === 'completed' ? 'badge-green' : 'badge-gray'
                  }">
                    {labels.eventStatus[ev.status]}
                  </span>
                </td>
                <td class="text-sm">{ev.affected_areas || '-'}</td>
                <td class="text-sm">{formatDate(ev.start_time, 'MM-DD HH:mm')}</td>
                <td class="text-sm">{formatDate(ev.end_time, 'MM-DD HH:mm')}</td>
                <td>
                  <div class="flex items-center gap-1">
                    {#if $selectedEvent?.id !== ev.id}
                      <button
                        on:click={() => setCurrentEvent(ev)}
                        class="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        设为当前
                      </button>
                    {/if}
                    <button
                      on:click={() => openEdit(ev)}
                      class="px-2 py-1 text-xs rounded bg-gray-50 text-gray-600 hover:bg-gray-100"
                    >编辑</button>
                    <button
                      on:click={() => handleDelete(ev)}
                      class="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                    >删除</button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <Modal title={editingEvent ? '编辑降雪事件' : '新建降雪事件'} show={showCreateModal} size="lg" on:close={() => showCreateModal = false}>
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">事件名称 <span class="text-red-500">*</span></label>
          <input class="input" bind:value={formData.event_name} placeholder="例如：2026年1月全市大到暴雪" />
        </div>
        <div>
          <label class="label">降雪等级 <span class="text-red-500">*</span></label>
          <select class="select" bind:value={formData.snow_level}>
            {#each Object.entries(labels.snowLevel) as [key, val]}
              <option value={key}>{val}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">开始时间 <span class="text-red-500">*</span></label>
          <input type="datetime-local" class="input" bind:value={formData.start_time} />
        </div>
        <div>
          <label class="label">结束时间</label>
          <input type="datetime-local" class="input" bind:value={formData.end_time} />
        </div>
      </div>
      <div>
        <label class="label">影响区域</label>
        <input class="input" bind:value={formData.affected_areas} placeholder="例如：东城区、西城区、全市" />
      </div>
      <div>
        <label class="label">事件描述</label>
        <textarea class="input min-h-[80px]" bind:value={formData.description} placeholder="气象预报、气温、预计持续时间等"></textarea>
      </div>
      <div>
        <label class="label">状态</label>
        <select class="select" bind:value={formData.status}>
          {#each Object.entries(labels.eventStatus) as [key, val]}
            <option value={key}>{val}</option>
          {/each}
        </select>
      </div>
    </div>
    <div slot="footer" class="flex items-center justify-end gap-2">
      <button class="btn-secondary" on:click={() => showCreateModal = false}>取消</button>
      <button class="btn-primary" on:click={handleSave}>保存</button>
    </div>
  </Modal>
</div>
