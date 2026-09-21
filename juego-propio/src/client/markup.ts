/**
 * Marcado del juego.
 *
 * Vive en un módulo en vez de en el HTML para que las dos entradas —el cliente
 * normal y la demo sin servidor— compartan exactamente la misma interfaz.
 */
export const GAME_MARKUP = `
<!-- Pantalla de entrada: nombre y colores del avatar -->
<div id="login" class="overlay">
  <form id="login-form" class="panel login-panel">
    <h1>Hotel</h1>
    <p class="tagline">Un juego social isométrico. Elige tu aspecto y entra.</p>

    <label class="field">
      <span>Tu nombre</span>
      <input id="name-input" type="text" maxlength="16" autocomplete="off" required />
    </label>

    <div class="look-editor">
      <canvas id="look-preview" width="120" height="150"></canvas>
      <div class="swatches">
        <label class="field swatch"><span>Piel</span><input type="color" data-part="skin" /></label>
        <label class="field swatch"><span>Pelo</span><input type="color" data-part="hair" /></label>
        <label class="field swatch"><span>Camiseta</span><input type="color" data-part="shirt" /></label>
        <label class="field swatch"><span>Pantalón</span><input type="color" data-part="pants" /></label>
        <label class="field swatch"><span>Zapatos</span><input type="color" data-part="shoes" /></label>
        <button type="button" id="randomize" class="ghost">Aspecto al azar</button>
      </div>
    </div>

    <button type="submit" class="primary">Entrar al hotel</button>
    <p id="login-error" class="error" hidden></p>
  </form>
</div>

<!-- Juego -->
<main id="game" hidden>
  <canvas id="stage"></canvas>

  <header class="hud hud-top">
    <div class="room-title">
      <strong id="room-name">—</strong>
      <span id="room-desc"></span>
    </div>
    <div class="badges">
      <span id="status" class="badge">conectando</span>
      <button id="toggle-rooms" class="ghost small">Salas</button>
      <button id="toggle-build" class="ghost small">Construir</button>
    </div>
  </header>

  <aside id="rooms-panel" class="hud panel side-panel" hidden>
    <h2>Salas</h2>
    <ul id="room-list"></ul>
    <h2>En esta sala</h2>
    <ul id="user-list"></ul>
  </aside>

  <aside id="build-panel" class="hud panel side-panel build" hidden>
    <h2>Catálogo</h2>
    <p class="hint">
      Clic en una baldosa para colocar · clic en un mueble para girarlo ·
      clic derecho para quitarlo
    </p>
    <ul id="furni-list"></ul>
    <button id="build-off" class="ghost small">Salir del modo construcción</button>
  </aside>

  <footer class="hud hud-bottom">
    <div id="chat-log" class="chat-log" aria-live="polite"></div>
    <form id="chat-form" class="chat-form">
      <input
        id="chat-input"
        type="text"
        maxlength="140"
        placeholder="Escribe algo… (Intro para enviar, /ayuda para los comandos)"
        autocomplete="off"
      />
      <button type="button" data-gesture="wave" class="ghost small" title="Saludar">👋</button>
      <button type="button" data-gesture="dance" class="ghost small" title="Bailar">💃</button>
      <button type="submit" class="primary small">Enviar</button>
    </form>
  </footer>
</main>
`;

/** Inserta la interfaz en la página si todavía no está. */
export function mountMarkup(): void {
  if (document.getElementById('login')) return;
  const host = document.createElement('div');
  host.innerHTML = GAME_MARKUP;
  document.body.append(...host.childNodes);
}
