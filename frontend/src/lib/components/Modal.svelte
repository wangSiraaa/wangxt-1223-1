<script>
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let show = false;
  export let size = 'md';

  const dispatch = createEventDispatcher();

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  function close() {
    dispatch('close');
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) {
      dispatch('close');
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdrop} on:keydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal-content {sizes[size] || sizes.md}">
      {#if title}
        <div class="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
          <button on:click={close} class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      {/if}
      <div class="p-5">
        <slot />
      </div>
      <div class="flex items-center justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50">
        <slot name="footer">
          <button on:click={close} class="btn-secondary">关闭</button>
        </slot>
      </div>
    </div>
  </div>
{/if}
