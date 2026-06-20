<script>
  import { onMount } from 'svelte';
  import {
    api,
    labels,
    severityColors,
    formatDate,
  } from '$lib/api/index.js';
  import { showToast, selectedEvent, alertRefreshTrigger, refreshAlerts } from '$lib/stores/user.js';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let alerts = [];
  let stats = {};
  let total = 0;
  let page = 1;
  let pageSize = 50;
  let filterType = '';
  let filterSeverity = '';
  let filterResolved = '';

  let alertDetail = null;
  let resolveForm = { resolution_note: '' };

  async function loadData() {
    loading = true;
    try {
      const params = { page, pageSize };
      if ($selectedEvent?.id) params.event_id = $selectedEvent.id;
      if (filterType) params.alert_type = filterType;
      if (filterSeverity) params.severity = filterSeverity;
      if (filterResolved === 'unresolved') params.is_resolved = false;
      else if (filterResolved === 'resolved') params.is_resolved = true;

      const [alertsRes, statsRes] = await Promise.all([
        api.alerts.list(params),
        api.alerts.stats({ event_id: $selectedEvent?.id || undefined }),
      ]);
      alerts = alertsRes.data?.list || alertsRes.data || [];
      total = alertsRes.data?.total || alerts.length;
      stats = statsRes.data || {};
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function runChecks() {
    try {
      const res = await api.alerts.check({ event_id: $selectedEvent?.id || undefined });
      showToast(
        `预警检查完成，新增 ${res.data?.new_alerts?.length || 0} 条预警`,
        res.data?.new_alerts?.length > 0 ? 'warning' : 'info'
      );
      refreshAlerts();
      loadData();
    } catch (e) {
      showToast(e.message || '检查失败', 'error');
    }
  }

  async function markAllRead() {
    try {
      await api.alerts.markAllRead({ event_id: $selectedEvent?.id || undefined });
      showToast('全部标记已读', 'success');
      refreshAlerts();
      loadData();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  async function handleMarkRead(a) {
    try {
      await api.alerts.markRead(a.id);
      loadData();
    } catch (e) {
      // ignore
    }
  }

  function openDetail(a) {
    alertDetail = a;
    resolveForm.resolution_note = '';
  }

  async function handleResolve() {
    try {
      await api.alerts.resolve(alertDetail.id, {
        resolution_note: resolveForm.resolution_note,
      });
      showToast('预警已处理', 'success');
      alertDetail = null;
      refreshAlerts();
      loadData();
    } catch (e) {
      showToast(e.message || '操作失败', 'error');
    }
  }

  const severityIcons = {
    critical: '🔥',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const alertTypeIcons = {
    key_route_unassigned: '🛣️',
    salt_insufficient: '📦',
    road_closed: '🚧',
    mission_delay: '⏰',
    inventory_low: '🏭',
  };

  $: $selectedEvent, loadData();
  $: $alertRefreshTrigger, loadData();
  onMount(loadData);
</script>

<div class="space-y-6">
  <div class="grid grid-cols-5 gap-3">
    <div class="stat-card bg-gradient-to-br from-gray-50 to-white">
      <div class="stat-label">预警总数</div>
      <div class="stat-value">{stats.totals?.total || 0}</div>
    </div>
    <div class="stat-card bg-gradient-to-br from-red-50 to-white border-red-100">
      <div class="stat-label text-red-600">严重</div>
      <div class="stat-value text-red-600">{(stats.by_severity || []).find((s) => s.severity === 'critical')?.unresolved || 0}</div>
    </div>
    <div class="stat-card bg-gradient-to-br from-yellow-50 to-white border-yellow-100">
      <div class="stat-label text-yellow-600">警告</div>
      <div class="stat-value text-yellow-600">{(stats.by_severity || []).find((s) => s.severity === 'warning')?.unresolved || 0}</div>
    </div>
    <div class="stat-card bg-gradient-to-br from-blue-50 to-white border-blue-100">
      <div class="stat-label text-blue-600">未处理</div>
      <div class="stat-value text-blue-600">{stats.totals?.unresolved || 0}</div>
    </div>
    <div class="stat-card bg-gradient-to-br from-green-50 to-white border-green-100">
      <div class="stat-label text-green-600">已处理</div>
      <div class="stat-value text-green-600">{(stats.totals?.total || 0) - (stats.totals?.unresolved || 0)}</div>
    </div>
  </div>

  <div class="card p-4">
    <div class="grid grid-cols-5 gap-3">
      {#each stats.by_type || [] as t}
        <div class="rounded-lg border border-gray-100 p-3 bg-gray-50/50">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 flex items-center gap-1">
              {alertTypeIcons[t.alert_type] || '🔔'} {labels.alertType[t.alert_type]}
            </span>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-gray-900">{t.count}</span>
            {#if t.unresolved > 0}
              <span class="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                未解决 {t.unresolved}
              </span>
            {/if}
          </div>
        </div>
      {:else}
        <div class="col-span-5 text-center py-4 text-gray-400 text-sm">暂无分类统计</div>
      {/each}
    </div>
  </div>

  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3 flex-wrap">
      <select
        class="select w-auto"
        bind:value={filterSeverity}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部级别</option>
        <option value="critical">🔥 严重</option>
        <option value="warning">⚠️ 警告</option>
        <option value="info">ℹ️ 提示</option>
      </select>
      <select
        class="select w-auto"
        bind:value={filterType}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部类型</option>
        {#each Object.entries(labels.alertType) as [k, v]}
          <option value={k}>{v}</option>
        {/each}
      </select>
      <select
        class="select w-auto"
        bind:value={filterResolved}
        on:change={() => {
          page = 1;
          loadData();
        }}
      >
        <option value="">全部</option>
        <option value="unresolved">未解决</option>
        <option value="resolved">已解决</option>
      </select>
      <div class="text-sm text-gray-500">共 {total} 条</div>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-secondary" on:click={markAllRead}>全部标已读</button>
      <button class="btn-primary" on:click={runChecks}>🔄 执行预警检查</button>
    </div>
  </div>

  {#if loading}
    <EmptyState loading />
  {:else if alerts.length === 0}
    <EmptyState emptyText="暂无预警记录，执行预警检查生成" />
  {:else}
    <div class="space-y-3">
      {#each alerts as a}
        <div
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer {a.is_resolved ? 'opacity-60' : ''}"
          on:click={() => {
            if (!a.is_read) handleMarkRead(a);
            openDetail(a);
          }}
        >
          <div class="flex items-start gap-4">
            <div
              class="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-xl {a.severity === 'critical'
                ? 'bg-red-100 text-red-600'
                : a.severity === 'warning'
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-blue-100 text-blue-600'}"
            >
              {alertTypeIcons[a.alert_type] || severityIcons[a.severity]}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                {#if !a.is_read}
                  <span class="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                {/if}
                <h3 class="font-semibold text-gray-900">{a.title}</h3>
                <span class="{severityColors[a.severity]}">{labels.severity[a.severity]}</span>
                <span class="badge-blue">{labels.alertType[a.alert_type]}</span>
                {#if a.is_resolved}
                  <span class="badge-green">✅ 已解决</span>
                {/if}
              </div>
              <p class="text-sm text-gray-600 mb-2 line-clamp-2">{a.description}</p>
              <div class="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                <span>{a.alert_code}</span>
                <span>创建于 {formatDate(a.created_at, 'YYYY-MM-DD HH:mm')}</span>
                {#if a.road_name}
                  <span>🚧 {a.road_name}</span>
                {/if}
                {#if a.event_name}
                  <span>❄️ {a.event_name}</span>
                {/if}
                {#if a.mission_code}
                  <span>📋 {a.mission_code}</span>
                {/if}
                {#if a.plate_number}
                  <span>🚛 {a.plate_number}</span>
                {/if}
                {#if a.warehouse_name}
                  <span>🏭 {a.warehouse_name}</span>
                {/if}
                {#if a.resolved_at}
                  <span class="text-green-600">
                    解决于 {formatDate(a.resolved_at, 'HH:mm')} by {a.resolved_by_name || '系统'}
                  </span>
                {/if}
              </div>
            </div>
            {#if !a.is_resolved}
              <button
                class="btn-success text-sm shrink-0"
                on:click|stopPropagation={openDetail(a)}
              >处理</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <Modal title="预警详情" show={!!alertDetail} size="lg" on:close={() => alertDetail = null}>
    <div class="space-y-4">
      {#if alertDetail.severity === 'critical'}
        <div class="rounded-lg p-4 border bg-red-50 border-red-200">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{severityIcons.critical}</span>
            <h3 class="text-lg font-bold text-gray-900">{alertDetail.title}</h3>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="{severityColors.critical}">级别：{labels.severity.critical}</span>
            <span class="badge-blue">类型：{labels.alertType[alertDetail.alert_type]}</span>
            {#if alertDetail.is_resolved}
              <span class="badge-green">已解决</span>
            {/if}
          </div>
        </div>
      {:else if alertDetail.severity === 'warning'}
        <div class="rounded-lg p-4 border bg-yellow-50 border-yellow-200">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{severityIcons.warning}</span>
            <h3 class="text-lg font-bold text-gray-900">{alertDetail.title}</h3>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="{severityColors.warning}">级别：{labels.severity.warning}</span>
            <span class="badge-blue">类型：{labels.alertType[alertDetail.alert_type]}</span>
            {#if alertDetail.is_resolved}
              <span class="badge-green">已解决</span>
            {/if}
          </div>
        </div>
      {:else}
        <div class="rounded-lg p-4 border bg-blue-50 border-blue-200">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{severityIcons.info}</span>
            <h3 class="text-lg font-bold text-gray-900">{alertDetail.title}</h3>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="{severityColors.info}">级别：{labels.severity.info}</span>
            <span class="badge-blue">类型：{labels.alertType[alertDetail.alert_type]}</span>
            {#if alertDetail.is_resolved}
              <span class="badge-green">已解决</span>
            {/if}
          </div>
        </div>
      {/if}
      <div>
        <label class="label">预警描述</label>
        <div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
          {alertDetail.description || '无详细描述'}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-gray-500">预警编码：</span>{alertDetail.alert_code}
        </div>
        <div>
          <span class="text-gray-500">创建时间：</span>{formatDate(alertDetail.created_at)}
        </div>
        {#if alertDetail.road_name}
          <div>
            <span class="text-gray-500">关联道路：</span>{alertDetail.road_name}
          </div>
        {/if}
        {#if alertDetail.event_name}
          <div>
            <span class="text-gray-500">关联事件：</span>{alertDetail.event_name}
          </div>
        {/if}
        {#if alertDetail.vehicle_id}
          <div>
            <span class="text-gray-500">关联车辆：</span>{alertDetail.plate_number || '-'}
          </div>
        {/if}
        {#if alertDetail.resolution_note}
          <div class="col-span-2">
            <span class="text-gray-500">解决说明：</span>{alertDetail.resolution_note}
          </div>
        {/if}
      </div>
      {#if !alertDetail.is_resolved}
        <div>
          <label class="label">处理说明</label>
          <textarea
            class="input min-h-[80px]"
            bind:value={resolveForm.resolution_note}
            placeholder="请填写处理结果、采取的措施等说明，或直接标记为已解决"
          ></textarea>
        </div>
      {/if}
      {#if alertDetail.alert_type === 'key_route_unassigned' && alertDetail.road_id}
        <a
          href="/missions"
          class="block text-center text-sm bg-primary-50 text-primary-700 hover:bg-primary-100 py-2 rounded-lg transition-colors"
        >→ 前往分配任务</a>
      {:else if alertDetail.alert_type === 'salt_insufficient' && alertDetail.vehicle_id}
        <a
          href="/inventory"
          class="block text-center text-sm bg-primary-50 text-primary-700 hover:bg-primary-100 py-2 rounded-lg transition-colors"
        >→ 前往仓库装盐</a>
      {:else if alertDetail.alert_type === 'road_closed' && alertDetail.road_id}
        <a
          href="/closures"
          class="block text-center text-sm bg-primary-50 text-primary-700 hover:bg-primary-100 py-2 rounded-lg transition-colors"
        >→ 查看封控详情</a>
      {:else if alertDetail.alert_type === 'inventory_low' && alertDetail.warehouse_id}
        <a
          href="/warehouse"
          class="block text-center text-sm bg-primary-50 text-primary-700 hover:bg-primary-100 py-2 rounded-lg transition-colors"
        >→ 前往补货入库</a>
      {/if}
    </div>
    <div slot="footer" class="flex items-center justify-between">
      <div class="text-xs text-gray-500">
        {#if alertDetail.is_resolved}
          此预警已于 {formatDate(alertDetail.resolved_at, 'YYYY-MM-DD HH:mm')} 解决
        {:else}
          建议在处理完成后填写说明并标记为已解决
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-secondary" on:click={() => alertDetail = null}>关闭</button>
        {#if !alertDetail.is_resolved}
          <button class="btn-success" on:click={handleResolve}>✅ 标记已解决</button>
        {/if}
      </div>
    </div>
  </Modal>
</div>
