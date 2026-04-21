<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { normalizeVoice } from '$lib/voice';

	let showShare = $state(false);
	let joinCode = $state('');
	let joinError = $state('');
	let newItemText = $state('');
	let voiceActive = $state(false);
	let voiceTranscript = $state('');
	let voiceSupported = $state(false);
	let showIosInstall = $state(false);
	let deferredPrompt = $state<Event | null>(null);
	let recognition: SpeechRecognition | null = null;
	let joinInputs: HTMLInputElement[] = [];

	onMount(() => {
		store.init();

		// Voice support detection
		const SpeechRecognition =
			window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
		voiceSupported = !!SpeechRecognition;

		// iOS install banner (show once)
		const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const isInStandalone = ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
		const bannerDismissed = localStorage.getItem('shopy_ios_banner');
		if (isIos && !isInStandalone && !bannerDismissed) {
			showIosInstall = true;
		}

		// Android install prompt
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e;
		});
	});

	function dismissIosBanner() {
		showIosInstall = false;
		localStorage.setItem('shopy_ios_banner', '1');
	}

	async function triggerInstall() {
		if (!deferredPrompt) return;
		(deferredPrompt as { prompt: () => Promise<void> }).prompt();
		deferredPrompt = null;
	}

	function addItem() {
		const text = newItemText.trim();
		if (!text) return;
		store.addItem(text.replace(/^./, (c) => c.toUpperCase()));
		newItemText = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addItem();
	}

	function startVoice() {
		const SpeechRecognition =
			window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
		if (!SpeechRecognition) return;
		recognition = new SpeechRecognition();
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = 'en-US';

		recognition.onresult = (event) => {
			const last = event.results[event.results.length - 1];
			voiceTranscript = last[0].transcript;
		};

		recognition.onend = () => {
			voiceActive = false;
			if (voiceTranscript.trim()) {
				const normalized = normalizeVoice(voiceTranscript);
				if (normalized) store.addItem(normalized);
			}
			voiceTranscript = '';
		};

		recognition.onerror = () => {
			voiceActive = false;
			voiceTranscript = '';
		};

		recognition.start();
		voiceActive = true;
	}

	function stopVoice() {
		recognition?.stop();
	}

	function handleShare() {
		showShare = true;
		joinCode = '';
		joinError = '';
	}

	function handleJoinInput(e: Event, idx: number) {
		const input = e.target as HTMLInputElement;
		const val = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 1);
		input.value = val;
		const chars = joinInputs.map((el) => el?.value ?? '');
		joinCode = chars.join('');
		if (val && idx < 5) joinInputs[idx + 1]?.focus();
	}

	function handleJoinKeydown(e: KeyboardEvent, idx: number) {
		if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && idx > 0) {
			joinInputs[idx - 1]?.focus();
		}
	}

	function handleJoin() {
		if (joinCode.length !== 6) {
			joinError = 'Enter all 6 characters';
			return;
		}
		const ok = store.joinRoom(joinCode);
		if (ok) {
			showShare = false;
		} else {
			joinError = 'Invalid code';
		}
	}

	function handleNewRoom() {
		store.newRoom();
		showShare = false;
	}

	const remaining = $derived(store.items.filter((i) => !i.done).length);
</script>

<!-- Offline banner -->
{#if store.offline || (!store.connected && store.items.length > 0)}
	<div class="offline-banner">Offline — changes will sync when reconnected</div>
{/if}

<!-- iOS install banner -->
{#if showIosInstall}
	<div class="ios-banner">
		<span>Install Shopy: tap <strong>Share</strong> then <strong>Add to Home Screen</strong></span>
		<button onclick={dismissIosBanner} aria-label="Dismiss">✕</button>
	</div>
{/if}

<main class="app">
	{#if showShare}
		<!-- Share / Join screen -->
		<div class="screen">
			<button class="back-btn" onclick={() => (showShare = false)}>← Back</button>
			<h1>Share list</h1>
			<p class="sub">No account needed</p>

			<div class="code-display">
				<div class="big-code">{store.roomId}</div>
				<p class="code-sub">Share this code. Anyone with it can join.</p>
			</div>

			{#if deferredPrompt}
				<button class="install-btn" onclick={triggerInstall}>Add Shopy to Home Screen</button>
			{/if}

			<div class="divider"><span>or join someone else's list</span></div>

			<p class="join-label">Enter a 6-character code</p>
			<div class="code-entry">
				{#each Array(6) as _, i}
					<input
						bind:this={joinInputs[i]}
						class="code-box"
						maxlength="1"
						inputmode="text"
						autocomplete="off"
						oninput={(e) => handleJoinInput(e, i)}
						onkeydown={(e) => handleJoinKeydown(e, i)}
					/>
				{/each}
			</div>
			{#if joinError}<p class="join-error">{joinError}</p>{/if}
			<button class="join-btn" onclick={handleJoin}>Join list →</button>
			<p class="note">No sign-up. Your data stays private.</p>

			<div class="divider"><span>or start fresh</span></div>
			<button class="secondary-btn" onclick={handleNewRoom}>Start a new list</button>
		</div>
	{:else}
		<!-- Main list screen -->
		<div class="screen">
			<div class="header">
				<div>
					<h1>Groceries</h1>
					<p class="sub">
						{remaining} item{remaining !== 1 ? 's' : ''} left
						{#if store.connected}<span class="sync-dot" title="Syncing"></span>{/if}
					</p>
				</div>
				<button class="share-pill" onclick={handleShare} aria-label="Share or join list">
					<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
						<circle cx="11" cy="2" r="1.5" stroke="currentColor" stroke-width="1.3"/>
						<circle cx="2" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.3"/>
						<circle cx="11" cy="11" r="1.5" stroke="currentColor" stroke-width="1.3"/>
						<path d="M3.3 7.3l5.4 2.8M3.3 5.7L8.7 2.9" stroke="currentColor" stroke-width="1.3"/>
					</svg>
					{store.roomId}
				</button>
			</div>

			<ul class="item-list">
				{#each store.items as item (item.id)}
					<li class="item" class:done={item.done}>
						<button
							class="checkbox"
							class:checked={item.done}
							onclick={() => store.toggleItem(item.id)}
							aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
						>
							{#if item.done}
								<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
									<path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							{/if}
						</button>
						<span class="item-text">{item.text}</span>
						<button
							class="remove-btn"
							onclick={() => store.removeItem(item.id)}
							aria-label="Remove {item.text}"
						>✕</button>
					</li>
				{/each}
			</ul>

			<div class="add-row">
				<input
					type="text"
					placeholder="Add item..."
					bind:value={newItemText}
					onkeydown={handleKeydown}
					class="add-input"
				/>
				<button class="add-btn" onclick={addItem} disabled={!newItemText.trim()} aria-label="Add item">+</button>
			</div>

			{#if voiceActive}
				<div class="voice-overlay">
					<div class="transcribing">
						<div class="wave">
							<span></span><span></span><span></span><span></span><span></span>
						</div>
						{#if voiceTranscript}
							<p class="transcript">"{voiceTranscript}"</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if voiceSupported}
				<div class="voice-area">
					<button
						class="voice-btn"
						class:active={voiceActive}
						onpointerdown={startVoice}
						onpointerup={stopVoice}
						onpointerleave={stopVoice}
						aria-label="Hold to speak"
					>
						<svg width="28" height="28" viewBox="0 0 28 28" fill="white" aria-hidden="true">
							<rect x="10" y="3" width="8" height="14" rx="4" fill="white"/>
							<path d="M6 14a8 8 0 0 0 16 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
							<line x1="14" y1="22" x2="14" y2="26" stroke="white" stroke-width="2" stroke-linecap="round"/>
							<line x1="10" y1="26" x2="18" y2="26" stroke="white" stroke-width="2" stroke-linecap="round"/>
						</svg>
					</button>
					<p class="voice-hint">{voiceActive ? 'Listening... release to add' : 'Hold to speak'}</p>
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	.offline-banner {
		background: #f5a623;
		color: white;
		text-align: center;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.ios-banner {
		background: #111;
		color: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		font-size: 13px;
		gap: 12px;
	}

	.ios-banner button {
		background: none;
		border: none;
		color: white;
		font-size: 16px;
		cursor: pointer;
		padding: 4px;
		flex-shrink: 0;
	}

	.app {
		max-width: 480px;
		margin: 0 auto;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.screen {
		background: white;
		flex: 1;
		padding: 24px 20px 40px;
		display: flex;
		flex-direction: column;
	}

	.back-btn {
		background: none;
		border: none;
		color: #666;
		font-size: 14px;
		cursor: pointer;
		padding: 0;
		margin-bottom: 24px;
		text-align: left;
	}

	h1 {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.5px;
		color: #111;
	}

	.sub {
		font-size: 13px;
		color: #999;
		margin-top: 3px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.sync-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		background: #22c55e;
		border-radius: 50%;
	}

	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.share-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: #f0f0f0;
		border: none;
		border-radius: 20px;
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 600;
		color: #444;
		cursor: pointer;
		letter-spacing: 0.05em;
		white-space: nowrap;
		flex-shrink: 0;
		margin-top: 4px;
	}

	.share-pill:hover {
		background: #e4e4e4;
	}

	.item-list {
		list-style: none;
		flex: 1;
		overflow-y: auto;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 13px 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.item.done .item-text {
		text-decoration: line-through;
		color: #bbb;
	}

	.checkbox {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1.5px solid #ccc;
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s, border-color 0.15s;
	}

	.checkbox.checked {
		background: #111;
		border-color: #111;
	}

	.item-text {
		flex: 1;
		font-size: 16px;
		color: #222;
	}

	.remove-btn {
		background: none;
		border: none;
		color: #ccc;
		font-size: 14px;
		cursor: pointer;
		padding: 4px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.item:hover .remove-btn {
		opacity: 1;
	}

	/* Always show remove on touch devices */
	@media (hover: none) {
		.remove-btn {
			opacity: 1;
		}
	}

	.add-row {
		display: flex;
		gap: 8px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #f0f0f0;
	}

	.add-input {
		flex: 1;
		border: none;
		border-bottom: 1.5px solid #e0e0e0;
		padding: 10px 0;
		font-size: 15px;
		color: #333;
		outline: none;
		background: transparent;
	}

	.add-input::placeholder {
		color: #ccc;
	}

	.add-input:focus {
		border-bottom-color: #111;
	}

	.add-btn {
		background: #111;
		color: white;
		border: none;
		border-radius: 8px;
		width: 36px;
		height: 36px;
		font-size: 22px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		align-self: flex-end;
		margin-bottom: 2px;
	}

	.add-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	/* Voice */
	.voice-overlay {
		background: #fff8f8;
		border: 1px dashed #e33;
		border-radius: 12px;
		padding: 14px 16px;
		margin-top: 16px;
	}

	.wave {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 24px;
		margin-bottom: 8px;
	}

	.wave span {
		display: inline-block;
		width: 4px;
		background: #e33;
		border-radius: 2px;
		height: 8px;
		animation: wave 0.8s ease-in-out infinite;
	}

	.wave span:nth-child(1) { animation-delay: 0s; }
	.wave span:nth-child(2) { animation-delay: 0.1s; }
	.wave span:nth-child(3) { animation-delay: 0.2s; }
	.wave span:nth-child(4) { animation-delay: 0.3s; }
	.wave span:nth-child(5) { animation-delay: 0.4s; }

	@keyframes wave {
		0%, 100% { height: 6px; }
		50% { height: 22px; }
	}

	.transcript {
		font-size: 14px;
		color: #e33;
		font-style: italic;
	}

	.voice-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding-top: 28px;
		margin-top: auto;
	}

	.voice-btn {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background: #111;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
		transition: transform 0.1s;
	}

	.voice-btn:active,
	.voice-btn.active {
		background: #e33;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 50, 50, 0.3); }
		50% { transform: scale(1.06); box-shadow: 0 0 0 14px rgba(220, 50, 50, 0); }
	}

	.voice-hint {
		font-size: 12px;
		color: #aaa;
	}

	.voice-btn.active ~ .voice-hint {
		color: #e33;
	}

	/* Share / join */
	.code-display {
		text-align: center;
		margin: 28px 0 16px;
	}

	.big-code {
		font-size: 42px;
		font-weight: 800;
		letter-spacing: 0.18em;
		color: #111;
		font-variant-numeric: tabular-nums;
	}

	.code-sub {
		font-size: 13px;
		color: #aaa;
		margin-top: 6px;
	}

	.install-btn {
		display: block;
		width: 100%;
		padding: 12px;
		background: #f0f0f0;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 16px;
		color: #333;
	}

	.divider {
		position: relative;
		text-align: center;
		margin: 20px 0;
		border-top: 1px solid #eee;
	}

	.divider span {
		position: absolute;
		top: -9px;
		left: 50%;
		transform: translateX(-50%);
		background: white;
		padding: 0 10px;
		font-size: 11px;
		color: #bbb;
		white-space: nowrap;
	}

	.join-label {
		font-size: 12px;
		color: #999;
		text-align: center;
		margin-bottom: 12px;
	}

	.code-entry {
		display: flex;
		gap: 7px;
		justify-content: center;
	}

	.code-box {
		width: 42px;
		height: 52px;
		border: 1.5px solid #ddd;
		border-radius: 10px;
		text-align: center;
		font-size: 22px;
		font-weight: 700;
		color: #111;
		outline: none;
		text-transform: uppercase;
		background: white;
		transition: border-color 0.15s;
	}

	.code-box:focus {
		border-color: #111;
	}

	.join-error {
		color: #e33;
		font-size: 12px;
		text-align: center;
		margin-top: 6px;
	}

	.join-btn {
		width: 100%;
		padding: 15px;
		background: #111;
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		margin-top: 16px;
		cursor: pointer;
	}

	.join-btn:hover {
		background: #222;
	}

	.secondary-btn {
		width: 100%;
		padding: 13px;
		background: transparent;
		color: #666;
		border: 1.5px solid #e0e0e0;
		border-radius: 12px;
		font-size: 14px;
		cursor: pointer;
	}

	.note {
		font-size: 11px;
		color: #aaa;
		text-align: center;
		margin-top: 10px;
	}
</style>
