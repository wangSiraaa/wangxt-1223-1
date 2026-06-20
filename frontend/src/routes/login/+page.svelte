<script>
  import { api, labels } from '$lib/api/index.js';
  import { setUser, showToast } from '$lib/stores/user.js';
  import { goto } from '$app/navigation';

  let username = 'commander01';
  let password = '123456';
  let loading = false;
  let errorMsg = '';

  const testAccounts = [
    { username: 'commander01', role: 'commander', name: '指挥中心' },
    { username: 'fleet01', role: 'fleet_manager', name: '车队长' },
    { username: 'warehouse01', role: 'warehouse_manager', name: '仓库管理员' },
  ];

  async function handleLogin() {
    if (!username || !password) {
      errorMsg = '请输入用户名和密码';
      return;
    }
    loading = true;
    errorMsg = '';
    try {
      const res = await api.dashboard.login({ username, password });
      setUser(res.data);
      showToast('登录成功，欢迎回来！', 'success');
      goto('/');
    } catch (e) {
      errorMsg = e.message || '登录失败，请检查用户名和密码';
    } finally {
      loading = false;
    }
  }

  function quickLogin(acc) {
    username = acc.username;
    password = '123456';
    handleLogin();
  }
</script>

<div class="min-h-screen flex items-center justify-center p-6">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary-500 to-snow-500 flex items-center justify-center text-white text-4xl shadow-xl mb-4">
        ❄️
      </div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">市政扫雪融冰调度系统</h1>
      <p class="text-gray-500 text-sm">Snow Clearance Dispatch Platform</p>
    </div>

    <div class="card p-6">
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
          <label class="label">用户名</label>
          <input
            type="text"
            bind:value={username}
            class="input"
            placeholder="请输入用户名"
            autocomplete="username"
          />
        </div>
        <div>
          <label class="label">密码</label>
          <input
            type="password"
            bind:value={password}
            class="input"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </div>
        {#if errorMsg}
          <div class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</div>
        {/if}
        <button type="submit" class="w-full btn-primary" disabled={loading}>
          {#if loading}
            <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          {/if}
          {loading ? '登录中...' : '登 录'}
        </button>
      </form>

      <div class="mt-6 pt-4 border-t border-gray-100">
        <div class="text-xs text-gray-500 mb-3">快速登录测试账号：</div>
        <div class="grid grid-cols-3 gap-2">
          {#each testAccounts as acc}
            <button
              on:click={() => quickLogin(acc)}
              class="text-xs px-2 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <div class="font-medium">{acc.name}</div>
              <div class="text-gray-400 mt-0.5">{acc.username}</div>
            </button>
          {/each}
        </div>
        <div class="text-xs text-gray-400 mt-3 text-center">
          默认密码：123456
        </div>
      </div>
    </div>

    <div class="mt-6 text-center text-xs text-gray-400">
      本系统用于市政扫雪融冰统一调度与指挥
    </div>
  </div>
</div>
