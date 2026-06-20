<script>
  import { page } from '$app/stores';
  import { selectedEvent, refreshAlerts } from '$lib/stores/user.js';
  import { api, labels, formatDate } from '$lib/api/index.js';
  import { onMount } from 'svelte';

  let events = [];
  let unreadAlerts = 0;
  let showAlertPanel = false;
  let alerts = [];
  let searchQuery = '';
  let searchResults = null;

  const pageTitles = {
    '/': '调度总览',
    '/map': '地图调度',
    '/events': '降雪事件管理',
    '/missions': '路线任务调度',
    '/vehicles': '车辆管理',
    '/roads': '道路管理',
    '/closures': '封控管理',
    '/warehouse': '仓库管理',
    '/inventory': '物资出入库',
    '/alerts': '预警中心',
    '/login': '系统登录',
  };

  function getPageTitle() {
    const path = $page.url.pathname;
    for (const [prefix, title] of Object.entries(pageTitles)) {
      if (prefix === '/' ? path === '/' : path.startsWith(prefix)) {
        return title;
      }
    }
    return '市政扫雪融冰调度系统';
  }

  async function loadEvents() {
    try {
      const res = await api.events.list({ pageSize: 100, status: 'active' });
      events = res.data?.list || res.data || [];
      if (events.length > 0 && !$selectedEvent) {
        $selectedEvent = events[0];
      }
    } catch (e) {
      // ignore
    }
  }

  async function loadAlerts() {
    try {
      const res = await api.alerts.list({ is_read: false, is_resolved: false, pageSize: 20 });
      alerts = res.data?.list || res.data || [];
      unreadAlerts = res.data?.total || alerts.length;
    } catch (e) {
      // ignore
    }
  }

  async function handleSearch() {
    if (searchQuery.length < 2) {
      searchResults = null;
      return;
    }
    try {
      const res = await api.dashboard.search({ q: searchQuery });
      searchResults = res.data;
    } catch (e) {
      searchResults = null;
    }
  }

  function selectEvent(e) {
    $selectedEvent = events.find((ev) => ev.id === e.target.value) || null;
    refreshAlerts();
  }

  async function toggleAlertPanel() {
    showAlertPanel = !showAlertPanel;
    if (showAlertPanel) {
      await loadAlerts();
    }
  }

  async function markAlertRead(alertId) {
    try {
      await api.alerts.markRead(alertId);
      alerts = alerts.map((a) => (a.id === alertId ? { ...a, is_read: true } : a));
      unreadAlerts = Math.max(0, unreadAlerts - 1);
    } catch (e) {
      // ignore
    }
  }

  onMount(() => {
    loadEvents();
    loadAlerts();
  });
</script>

<header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-40">
  <h1 class="text-lg font-semibold text-gray-900 shrink-0">{getPageTitle()}</h1>

  <div class="relative flex-1 max-w-md ml-6">
    <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
    <input
      type="text"
      bind:value={searchQuery}
      on:input={handleSearch}
      placeholder="搜索道路、车辆、事件、任务..."
      class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
    {#if searchResults}
      <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-80 overflow-y-auto z-50">
        {#if searchResults.roads?.length}
          <div class="p-2 border-b border-gray-50">
            <div class="text-xs text-gray-500 px-2 py-1">道路</div>
            {#each searchResults.roads as r}
              <a href="/roads" class="block px-2 py-1.5 hover:bg-gray-50 rounded">
                <span class="font-medium text-sm">{r.road_name}</span>
                <span class="text-xs text-gray-500 ml-2">{r.road_code}</span>
              </a>
            {/each}
          </div>
        {/if}
        {#if searchResults.vehicles?.length}
          <div class="p-2 border-b border-gray-50">
            <div class="text-xs text-gray-500 px-2 py-1">车辆</div>
            {#each searchResults.vehicles as v}
              <a href="/vehicles" class="block px-2 py-1.5 hover:bg-gray-50 rounded">
                <span class="font-medium text-sm">{v.plate_number}</span>
                <span class="text-xs text-gray-500 ml-2">{v.vehicle_type}</span>
              </a>
            {/each}
          </div>
        {/if}
        {#if searchResults.events?.length}
          <div class="p-2 border-b border-gray-50">
            <div class="text-xs text-gray-500 px-2 py-1">事件</div>
            {#each searchResults.events as ev}
              <a href="/events" class="block px-2 py-1.5 hover:bg-gray-50 rounded">
                <span class="font-medium text-sm">{ev.event_name}</span>
                <span class="text-xs text-gray-500 ml-2">{labels.snowLevel[ev.snow_level]}</span>
              </a>
            {/each}
          </div>
        {/if}
        {#if searchResults.missions?.length}
          <div class="p-2">
            <div class="text-xs text-gray-500 px-2 py-1">任务</div>
            {#each searchResults.missions as m}
              <a href="/missions" class="block px-2 py-1.5 hover:bg-gray-50 rounded">
                <span class="font-medium text-sm">{m.mission_code}</span>
                <span class="text-xs text-gray-500 ml-2">{labels.missionStatus[m.status]}</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if events.length > 0}
    <select
      class="select max-w-xs shrink-0"
      value={$selectedEvent?.id || ''}
      on:change={selectEvent}
    >
      <option value="">-- 选择降雪事件 --</option>
      {#each events as ev}
        <option value={ev.id}>
          [{labels.snowLevel[ev.snow_level]}] {ev.event_name}
        </option>
      {/each}
    </select>
  {/if}

  <div class="flex-1"></div>

  <div class="relative">
    <button
      on:click={toggleAlertPanel}
      class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
      </svg>
      {#if unreadAlerts > 0}
        <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {unreadAlerts > 99 ? '99+' : unreadAlerts}
        </span>
      {/if}
    </button>

    {#if showAlertPanel}
      <div class="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[70vh] flex flex-col">
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900">预警通知</h3>
          <span class="text-xs text-gray-500">共 {unreadAlerts} 条未处理</span>
        </div>
        <div class="flex-1 overflow-y-auto">
          {#if alerts.length === 0}
            <div class="p-8 text-center text-gray-400 text-sm">暂无预警</div>
          {:else}
            {#each alerts as alert}
              <div
                class="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                on:click={() => markAlertRead(alert.id)}
              >
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm {alert.severity === 'critical' ? 'bg-red-100 text-red-600' : alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}">
                    {alert.severity === 'critical' ? '🔥' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium text-sm text-gray-900 truncate">{alert.title}</span>
                      {#if !alert.is_read}
                        <span class="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                      {/if}
                    </div>
                    <p class="text-xs text-gray-500 line-clamp-2 mb-1">{alert.description}</p>
                    <div class="text-xs text-gray-400">{formatDate(alert.created_at, 'MM-DD HH:mm')}</div>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
        <div class="p-3 border-t border-gray-100">
          <a href="/alerts" class="text-sm text-primary-600 hover:text-primary-700 font-medium">查看全部预警 →</a>
        </div>
      </div>
    {/if}
  </div>

  <div class="text-sm text-gray-500 shrink-0 hidden lg:block">
    {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
  </div>
</header>
