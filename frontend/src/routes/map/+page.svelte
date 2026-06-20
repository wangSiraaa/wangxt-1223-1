<script>
  import { onMount, onDestroy } from 'svelte';
  import { api, labels, formatNumber } from '$lib/api/index.js';
  import { selectedEvent } from '$lib/stores/user.js';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let loading = true;
  let roadsGeo = null;
  let locationsGeo = null;
  let mapData = null;
  let roads = [];
  let vehicles = [];
  let closures = [];
  let missions = [];
  let selectedRoad = null;

  let mapError = null;
  let filterLevel = '';

  async function loadData() {
    loading = true;
    mapError = null;
    try {
      const params = $selectedEvent?.id ? { event_id: $selectedEvent.id } : {};
      const [mapRes, roadsRes, vehRes, closuresRes, missionsRes, roadsGeoRes, locationsGeoRes] =
        await Promise.all([
          api.dashboard.mapData(),
          api.roads.withMissions(params),
          api.vehicles.list(),
          api.closures.list({ status: 'active', ...params }),
          api.missions.list({ pageSize: 200, ...params }),
          fetch('/geojson/roads.geojson').then((r) => r.json()),
          fetch('/geojson/locations.geojson').then((r) => r.json()),
        ]).catch((e) => {
          console.warn('GeoJSON or API fetch partial fail:', e);
          return [null, null, null, null, null, null, null];
        });

      mapData = mapRes?.data || null;
      roads = roadsRes?.data || mapData?.roads || [];
      vehicles = vehRes?.data || mapData?.vehicles || [];
      closures = closuresRes?.data || mapData?.closures || [];
      missions = missionsRes?.data?.list || missionsRes?.data || [];
      roadsGeo = roadsGeoRes;
      locationsGeo = locationsGeoRes;
    } catch (e) {
      mapError = '地图数据加载失败，请刷新重试。错误：' + e.message;
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function findRoadGeoByCode(code) {
    return roadsGeo?.features?.find((f) => f.properties.road_code === code);
  }

  function getRoadDisplay(r) {
    const geo = findRoadGeoByCode(r.road_code);
    return geo ? { ...r, _geo: geo } : r;
  }

  const visibleRoads = filterLevel
    ? roads.filter((r) => r.road_level === filterLevel)
    : roads;

  $: $selectedEvent, loadData();
  onMount(loadData);

  const roadColorMap = {
    express: '#dc2626',
    main: '#ea580c',
    secondary: '#ca8a04',
    branch: '#65a30d',
  };

  const roadBgMap = {
    express: 'bg-red-500',
    main: 'bg-orange-500',
    secondary: 'bg-yellow-500',
    branch: 'bg-green-500',
  };
</script>

<div class="space-y-6">
  <div class="grid grid-cols-4 gap-3">
    <div class="stat-card">
      <div class="stat-label">道路总里程</div>
      <div class="stat-value">{formatNumber(roads.reduce((a, b) => a + Number(b.length_km || 0), 0), 1)}<span class="text-base font-normal text-gray-500 ml-1">km</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">封控路段</div>
      <div class="stat-value text-red-600">{closures.length}<span class="text-base font-normal text-gray-500 ml-1">条</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">作业中车辆</div>
      <div class="stat-value text-yellow-600">{vehicles.filter((v) => v.status === 'working').length}<span class="text-base font-normal text-gray-500 ml-1">辆</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">进行中任务</div>
      <div class="stat-value">{missions.filter((m) => ['assigned', 'salt_loaded', 'in_progress'].includes(m.status)).length}<span class="text-base font-normal text-gray-500 ml-1">个</span></div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
    <div class="lg:col-span-2 card p-4 flex flex-col">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="card-title">🗺️ 道路调度地图</h3>
        <div class="flex items-center gap-3 flex-wrap">
          <select class="select w-auto text-sm" bind:value={filterLevel}>
            <option value="">全部道路</option>
            {#each Object.entries(labels.roadLevel) as [k, v]}
              <option value={k}>{v}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if mapError}
        <div class="text-red-600 bg-red-50 p-4 rounded-lg">{mapError}</div>
      {/if}

      <div class="flex-1 rounded-xl border border-gray-100 overflow-hidden bg-gradient-to-br from-blue-50/30 to-green-50/30 relative">
        <svg
          viewBox="116.3 39.85 0.22 0.2"
          class="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {#if roadsGeo?.features}
            {#each roadsGeo.features as feature, i}
              {#if !filterLevel || feature.properties.road_level === filterLevel}
                {@const road = roads.find((r) => r.road_code === feature.properties.road_code)}
                {@const closedRoad = closures.find((c) => c.road_code === feature.properties.road_code || c.road_id === road?.id)}
                {@const hasMission = road && (road.active_mission_count > 0 || road.closure_count > 0)}
                {@const selected = selectedRoad?.road_code === feature.properties.road_code}
                <g
                  class="cursor-pointer transition-opacity hover:opacity-80"
                  on:click={() => (selectedRoad = road)}
                >
                  {#if road?.geojson_feature}
                    <!-- will use custom -->
                  {/if}
                  {#if feature.geometry.type === 'LineString'}
                    <polyline
                      points={feature.geometry.coordinates
                        .map(([lng, lat]) => `${lng},${lat}`)
                        .join(' ')}
                      fill="none"
                      stroke={
                        closedRoad
                          ? '#991b1b'
                          : hasMission && road?.status === 'processing'
                          ? '#16a34a'
                          : feature.properties.color || roadColorMap[feature.properties.road_level]
                      }
                      stroke-width={
                        selected
                          ? (feature.properties.width || 4) * 1.6
                          : feature.properties.width || 4
                      }
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-dasharray={closedRoad ? '8 6' : '0'}
                      opacity={selected ? 1 : 0.9}
                    />
                  {/if}
                  {#if closedRoad}
                    {#each feature.geometry.coordinates as [lng, lat], j}
                      {#if j % 8 === 0}
                        <g transform={`translate(${lng}, ${lat})`}>
                          <circle r="0.003" fill="#fee2e2" />
                          <text text-anchor="middle" dy="1" font-size="0.01">🚧</text>
                        </g>
                      {/if}
                    {/each}
                  {/if}
                </g>
              {/if}
            {/each}
          {/if}

          {#if locationsGeo?.features}
            {#each locationsGeo.features as f}
              <g transform={`translate(${f.geometry.coordinates[0]}, ${f.geometry.coordinates[1]})`}>
                <circle r="0.004" fill="#fff" stroke="#9ca3af" stroke-width="0.5" />
                <text text-anchor="middle" dy="1.5" font-size="0.015">
                  {f.properties.type === 'warehouse' ? '🏭' : f.properties.type === 'fleet' ? '🅿️' : f.properties.type === 'police' ? '👮' : '🎯'}
                </text>
              </g>
            {/each}
          {/if}

          {#each vehicles.filter((v) => v.status === 'working' && v.current_missions?.length) as v}
            {#each v.current_missions as m}
              {#if m.road_id}
                {@const geo = roads.find((r) => r.id === m.road_id)}
                {#if geo && findRoadGeoByCode(geo.road_code)}
                  {@const coords = findRoadGeoByCode(geo.road_code).geometry.coordinates}
                  {@const mid = coords[Math.floor(coords.length / 2)]}
                  <g transform={`translate(${mid[0]}, ${mid[1]})`}>
                    <circle r="0.006" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.5" class="animate-pulse-slow" />
                    <text text-anchor="middle" dy="1.2" font-size="0.013">🚛</text>
                  </g>
                {/if}
              {/if}
            {/each}
          {/each}
        </svg>
      </div>

      <div class="mt-3 flex flex-wrap gap-4 text-xs items-center">
        {#each Object.entries(labels.roadLevel) as [k, v]}
          <div class="flex items-center gap-1.5">
            <span class="w-4 h-1.5 rounded-full {roadBgMap[k]}"></span>
            <span class="text-gray-600">{v}</span>
          </div>
        {/each}
        <div class="flex items-center gap-1.5">
          <span class="w-4 h-1.5 rounded-full bg-green-600"></span>
          <span class="text-gray-600">作业中</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-4 h-1.5 rounded-full bg-red-900" style="background-image: repeating-linear-gradient(90deg, #7f1d1d 0 4px, transparent 4px 8px);"></span>
          <span class="text-gray-600">封控路段</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full border border-gray-400 bg-white inline-flex items-center justify-center text-[8px]">🏭</span>
          <span class="text-gray-600">仓库</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full border border-yellow-500 bg-yellow-100 inline-flex items-center justify-center text-[8px]">🚛</span>
          <span class="text-gray-600">作业车辆</span>
        </div>
      </div>
    </div>

    <div class="card flex flex-col overflow-hidden">
      <div class="card-header shrink-0">
        <h3 class="card-title">📋 道路作业状态</h3>
      </div>
      {#if loading}
        <EmptyState loading />
      {:else if visibleRoads.length === 0}
        <div class="flex-1 flex items-center justify-center text-gray-400 text-sm p-8">
          暂无道路数据
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto divide-y divide-gray-50">
          {#each visibleRoads as r}
            {@const selected = selectedRoad?.id === r.id}
            {@const rClosures = closures.filter((c) => c.road_id === r.id)}
            <div
              class="p-3 cursor-pointer transition-colors {selected ? 'bg-primary-50' : 'hover:bg-gray-50'}"
              on:click={() => (selectedRoad = r)}
            >
              <div class="flex items-start gap-3">
                <span class="w-1.5 h-full min-h-[40px] rounded-full shrink-0 {roadBgMap[r.road_level]}"></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="font-medium text-gray-900 truncate">
                      {r.road_name}
                      {#if r.is_key_route}
                        <span class="badge-red text-[9px] ml-1">⭐重点</span>
                      {/if}
                    </span>
                    <span class="badge {
                      r.status === 'normal' ? 'badge-gray' :
                      r.status === 'closed' ? 'badge-red' :
                      r.status === 'processing' ? 'badge-yellow' : 'badge-green'
                    } text-[10px]">
                      {labels.roadStatus[r.status]}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mb-2">
                    {labels.roadLevel[r.road_level]} · P{r.priority} · {r.length_km}km · {r.lanes}道
                    {#if r.active_mission_count > 0}
                      · <span class="text-green-600 font-medium">{r.active_mission_count} 辆车作业中</span>
                    {/if}
                  </div>
                  {#if rClosures.length > 0}
                    <div class="text-xs bg-red-50 text-red-700 rounded px-2 py-1 mb-1">
                      🚧 {rClosures[0].closure_reason}
                    </div>
                  {/if}
                  {#if r.active_mission_count === 0 && r.status !== 'closed' && r.is_key_route}
                    <div class="text-xs bg-yellow-50 text-yellow-700 rounded px-2 py-1">
                      ⚠️ 重点道路未安排车辆，请尽快调度
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div class="card p-4">
      <h4 class="font-semibold text-gray-900 mb-3">🏭 仓库位置</h4>
      <div class="space-y-2">
        {#each locationsGeo?.features?.filter((f) => f.properties.type === 'warehouse') || [] as f}
          <div class="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
            <span class="text-xl">🏭</span>
            <div class="flex-1">
              <div class="font-medium">{f.properties.name}</div>
              <div class="text-xs text-gray-500">{f.properties.address}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="card p-4">
      <h4 class="font-semibold text-gray-900 mb-3">🅿️ 车队位置</h4>
      <div class="space-y-2">
        {#each locationsGeo?.features?.filter((f) => f.properties.type === 'fleet') || [] as f}
          <div class="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
            <span class="text-xl">🅿️</span>
            <div class="flex-1">
              <div class="font-medium">{f.properties.name}</div>
              <div class="text-xs text-gray-500">{f.properties.team}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="card p-4">
      <h4 class="font-semibold text-gray-900 mb-3">🚧 进行中封控</h4>
      <div class="space-y-2">
        {#if closures.length === 0}
          <div class="text-sm text-gray-400 text-center py-4">无进行中封控</div>
        {/if}
        {#each closures as c}
          <div class="flex items-center gap-2 text-sm p-2 rounded bg-red-50 border border-red-100">
            <span class="text-xl">🚧</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{c.road_name}</div>
              <div class="text-xs text-red-600 truncate">{labels.closureType[c.closure_type]}：{c.closure_reason}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
