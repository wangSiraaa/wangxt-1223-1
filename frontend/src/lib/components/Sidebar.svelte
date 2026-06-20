<script>
  import { page } from '$app/stores';
  import { user, clearUser } from '$lib/stores/user.js';
  import { goto } from '$app/navigation';
  import { labels } from '$lib/api/index.js';

  const menu = [
    { path: '/', name: '调度总览', icon: '📊', roles: ['commander', 'fleet_manager', 'warehouse_manager'] },
    { path: '/map', name: '地图调度', icon: '🗺️', roles: ['commander', 'fleet_manager'] },
    { path: '/events', name: '降雪事件', icon: '❄️', roles: ['commander'] },
    { path: '/missions', name: '路线调度', icon: '🚚', roles: ['commander', 'fleet_manager'] },
    { path: '/vehicles', name: '车辆管理', icon: '🚛', roles: ['commander', 'fleet_manager'] },
    { path: '/roads', name: '道路管理', icon: '🛣️', roles: ['commander', 'fleet_manager'] },
    { path: '/closures', name: '封控管理', icon: '🚧', roles: ['commander'] },
    { path: '/warehouse', name: '仓库管理', icon: '🏭', roles: ['commander', 'warehouse_manager'] },
    { path: '/inventory', name: '物资出入库', icon: '📦', roles: ['warehouse_manager', 'commander'] },
    { path: '/alerts', name: '预警中心', icon: '🔔', roles: ['commander', 'fleet_manager', 'warehouse_manager'] },
  ];

  function isActive(path) {
    if (path === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(path);
  }

  function visibleForRole(item) {
    return !$user || item.roles.includes($user.role);
  }

  function handleLogout() {
    clearUser();
    goto('/login');
  }
</script>

<aside class="w-60 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shrink-0">
  <div class="p-5 border-b border-gray-100">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-snow-500 flex items-center justify-center text-white text-xl">
        ❄️
      </div>
      <div>
        <div class="font-bold text-gray-900 text-sm">扫雪融冰调度</div>
        <div class="text-xs text-gray-500">Snow Dispatch System</div>
      </div>
    </div>
  </div>

  <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
    {#each menu.filter(visibleForRole) as item}
      <a href={item.path} class={isActive(item.path) ? 'nav-link-active' : 'nav-link'}>
        <span class="text-lg">{item.icon}</span>
        <span class="text-sm">{item.name}</span>
      </a>
    {/each}
  </nav>

  <div class="p-4 border-t border-gray-100">
    {#if $user}
      <div class="flex items-center gap-3 mb-3 p-2 rounded-lg bg-gray-50">
        <div class="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
          {$user.full_name?.charAt(0) || $user.username?.charAt(0) || 'U'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-sm text-gray-900 truncate">{$user.full_name || $user.username}</div>
          <div class="text-xs text-gray-500">{labels.userRole[$user.role]}</div>
        </div>
      </div>
      <button on:click={handleLogout} class="w-full btn-secondary text-sm">退出登录</button>
    {/if}
  </div>
</aside>
