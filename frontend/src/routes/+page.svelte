<script>
  import { onMount } from 'svelte';
  import { api, labels, missionStatusColors, vehicleStatusColors, formatDate, formatNumber } from '$lib/api/index.js';
  import { selectedEvent, alertRefreshTrigger } from '$lib/stores/user.js';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let stats = {};
  let timeline = [];

  async function loadData() {
    loading = true;
    try {
      const params = $selectedEvent?.id ? { event_id: $selectedEvent.id } : {};
      const [statsRes, timelineRes] = await Promise.all([
        api.dashboard.stats(params),
        api.dashboard.timeline({ limit: 20 }),
      ]);
      stats = statsRes.data;
      timeline = timelineRes.data;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $: $alertRefreshTrigger, loadData();
  $: $selectedEvent?.id, loadData();

  onMount(loadData);

  function sumGroup(arr, key) {
    if (!arr) return 0;
    return arr.reduce((acc, item) => acc + (parseInt(item[key]) || 0), 0);
  }
</script>

<div class="space-y-6">
  {#if $selectedEvent}
    <div class="card p-5 bg-gradient-to-r from-primary-50 to-snow-50 border-primary-100">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">❄️</span>
            <span class="badge {
              $selectedEvent.snow_level === 'light' ? 'badge-blue' :
              $selectedEvent.snow_level === 'moderate' ? 'badge-yellow' :
              $selectedEvent.snow_level === 'heavy' ? 'badge-red' : 'badge-red'
            }">
              {labels.snowLevel[$selectedEvent.snow_level]}
            </span>
            <span class="badge badge-green">{labels.eventStatus[$selectedEvent.status]}</span>
          </div>
          <h2 class="text-xl font-bold text-gray-900">{$selectedEvent.event_name}</h2>
          {#if $selectedEvent.affected_areas}
            <p class="text-sm text-gray-600 mt-1">影响区域：{$selectedEvent.affected_areas}</p>
          {/if}
          <p class="text-xs text-gray-500 mt-1">
            开始时间：{formatDate($selectedEvent.start_time)}
            {#if $selectedEvent.end_time}
              ～ {formatDate($selectedEvent.end_time)}
            {/if}
          </p>
        </div>
        {#if $selectedEvent.description}
          <div class="text-sm text-gray-600 max-w-md bg-white/50 rounded-lg p-3">
            {$selectedEvent.description}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <div class="stat-label">降雪事件</div>
        <div class="text-2xl">❄️</div>
      </div>
      <div class="stat-value">{sumGroup(stats.events, 'count')}</div>
      <div class="stat-trend flex gap-2 mt-2">
        {#each stats.events || [] as ev}
          <span class="badge {ev.status === 'active' ? 'badge-red' : ev.status === 'monitoring' ? 'badge-yellow' : 'badge-green'}">
            {labels.eventStatus[ev.status]} {ev.count}
          </span>
        {/each}
      </div>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <div class="stat-label">任务总数</div>
        <div class="text-2xl">📋</div>
      </div>
      <div class="stat-value">{sumGroup(stats.missions, 'count')}</div>
      <div class="stat-trend flex flex-wrap gap-1 mt-2">
        {#each stats.missions || [] as m}
          <span class="{missionStatusColors[m.status]}">{labels.missionStatus[m.status]} {m.count}</span>
        {/each}
      </div>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <div class="stat-label">车辆总数</div>
        <div class="text-2xl">🚛</div>
      </div>
      <div class="stat-value">{sumGroup(stats.vehicles, 'count')}</div>
      <div class="stat-trend flex flex-wrap gap-1 mt-2">
        {#each stats.vehicles || [] as v}
          <span class="{vehicleStatusColors[v.status]}">{labels.vehicleStatus[v.status]} {v.count}</span>
        {/each}
      </div>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-2">
        <div class="stat-label">融雪剂总库存</div>
        <div class="text-2xl">📦</div>
      </div>
      <div class="stat-value">{formatNumber((stats.inventory || []).reduce((a, b) => a + parseFloat(b.total_ton || 0), 0))}<span class="text-base font-normal text-gray-500 ml-1">吨</span></div>
      <div class="stat-trend flex flex-wrap gap-1 mt-2">
        {#each stats.inventory || [] as inv}
          <span class="badge-blue">{inv.salt_type === 'sodium_chloride' ? '氯化钠' : inv.salt_type === 'calcium_chloride' ? '氯化钙' : '混合盐'} {formatNumber(inv.total_ton, 1)}吨</span>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 space-y-6">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📣 预警通知中心</h3>
          <a href="/alerts" class="text-sm text-primary-600 hover:text-primary-700">查看全部 →</a>
        </div>
        <div class="p-5 space-y-3">
          {#if stats.alerts?.unresolved > 0}
            <div class="grid grid-cols-4 gap-3 mb-4">
              <div class="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                <div class="text-2xl font-bold text-red-600">{stats.alerts.critical || 0}</div>
                <div class="text-xs text-gray-500 mt-1">严重</div>
              </div>
              <div class="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
                <div class="text-2xl font-bold text-yellow-600">{stats.alerts.warning || 0}</div>
                <div class="text-xs text-gray-500 mt-1">警告</div>
              </div>
              <div class="bg-red-100 rounded-lg p-3 text-center border border-red-200">
                <div class="text-2xl font-bold text-red-700">{stats.alerts.key_route_unassigned || 0}</div>
                <div class="text-xs text-gray-500 mt-1">重点路未派</div>
              </div>
              <div class="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                <div class="text-2xl font-bold text-orange-600">{stats.alerts.road_closed || 0}</div>
                <div class="text-xs text-gray-500 mt-1">道路封控</div>
              </div>
            </div>
          {/if}

          {#if !stats.alerts || stats.alerts.unresolved === 0}
            <div class="py-8 text-center">
              <div class="text-4xl mb-2">✅</div>
              <div class="text-sm text-gray-500">当前无待处理预警</div>
            </div>
          {:else}
            <div class="text-center mb-2">
              <span class="text-sm text-gray-500">共 <b class="text-red-600">{stats.alerts.unresolved}</b> 条未解决预警，
              <b class="text-gray-700">{stats.alerts.unread}</b> 条未读</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🛣️ 道路作业进度</h3>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-4 gap-3 mb-5">
            {#each stats.roads || [] as r}
              <div class="rounded-lg p-4 text-center border {
                r.status === 'normal' ? 'bg-gray-50 border-gray-100' :
                r.status === 'closed' ? 'bg-red-50 border-red-100' :
                r.status === 'processing' ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
              }">
                <div class="text-3xl font-bold text-gray-900">{r.count}</div>
                <div class="text-xs text-gray-500 mt-1">{labels.roadStatus[r.status]}</div>
                <div class="text-xs text-gray-400 mt-0.5">其中重点 {r.key_count || 0}</div>
              </div>
            {/each}
          </div>
          <div class="flex justify-center gap-2 text-xs">
            <span class="badge-gray">
              道路总里程：
              {formatNumber(
                (stats.roads || []).reduce((a, b) => a + (b.total_km || 0), 0),
                1
              )} km
            </span>
            <span class="badge-green">
              融雪剂已使用：{formatNumber(stats.salt_usage?.used, 1)} 吨
            </span>
            <span class="badge-blue">
              已分配：{formatNumber(stats.salt_usage?.allocated, 1)} 吨
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-6">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🚧 封控路段</h3>
          <a href="/closures" class="text-sm text-primary-600 hover:text-primary-700">管理 →</a>
        </div>
        <div class="p-5">
          {#if (stats.closures || []).filter(c => c.status === 'active').length === 0}
            <div class="py-8 text-center">
              <div class="text-3xl mb-2">✅</div>
              <div class="text-sm text-gray-500">无进行中的封控</div>
            </div>
          {:else}
            {#each (stats.closures || []).filter(c => c.status === 'active') as c, i}
              <div class="py-3 {i > 0 ? 'border-t border-gray-100' : ''}">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-sm text-red-600">封控中</span>
                  <span class="text-xs text-gray-400">{c.count}条</span>
                </div>
                <div class="text-sm text-gray-700">{labels.eventStatus ? '' : ''}当前有 {c.count} 条封控</div>
              </div>
            {/each}
          {/if}
          <a href="/closures" class="mt-3 w-full btn-secondary text-sm">查看封控详情</a>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📅 动态时间线</h3>
        </div>
        <div class="p-0">
          {#if loading}
            <EmptyState loading />
          {:else if timeline.length === 0}
            <div class="p-8 text-center text-sm text-gray-400">暂无动态</div>
          {:else}
            <div class="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {#each timeline.slice(0, 15) as item}
                <div class="p-3 flex items-start gap-3 hover:bg-gray-50">
                  <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-sm">
                    {item.type === 'mission' ? '🚚' :
                     item.type === 'event' ? '❄️' :
                     item.type === 'closure' ? '🚧' :
                     item.type === 'alert' ? '🔔' : '📦'}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-gray-900 truncate">
                      <span class="font-medium">{item.code}</span>
                      <span class="text-gray-500 ml-1">{item.title}</span>
                    </div>
                    {#if item.extra}
                      <div class="text-xs text-gray-500 truncate mt-0.5">{item.extra}</div>
                    {/if}
                    <div class="text-xs text-gray-400 mt-1">{formatDate(item.created_at, 'MM-DD HH:mm')}</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <a href="/map" class="card p-4 hover:shadow-md transition-shadow block">
          <div class="text-2xl mb-1">🗺️</div>
          <div class="font-medium text-sm text-gray-900">地图调度</div>
          <div class="text-xs text-gray-500 mt-0.5">可视化作业路线</div>
        </a>
        <a href="/missions" class="card p-4 hover:shadow-md transition-shadow block">
          <div class="text-2xl mb-1">🚚</div>
          <div class="font-medium text-sm text-gray-900">路线调度</div>
          <div class="text-xs text-gray-500 mt-0.5">分配作业任务</div>
        </a>
      </div>
    </div>
  </div>
</div>
