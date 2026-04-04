// scripts/parametrizacion.js
// Requiere jQuery y opcionalmente SweetAlert2 (Swal)

const ENDPOINT_GET  = 'controladores/obtenerParametro.php';
const ENDPOINT_SAVE = 'controladores/guardarParametro.php';

const PARAM_EMPRESAS = 'EMPRESA';
const ENDPOINT_LISTAR_EMPRESAS = 'controladores/listarEmpresas.php';

const PARAM_BODEGAS = 'BODEGA';
const ENDPOINT_LISTAR_BODEGAS = 'controladores/listarBodegas.php';

const PARAM_PRECIOS = 'PRECIOS';
const ENDPOINT_LISTAR_PRECIOS = 'controladores/listarPrecios.php';

// Definición de parámetros y reglas
const PARAMS = [
  {
    code: 'URL',
    input: '#param-url',
    button: '#btn-guardar-url',
    desc: 'URL del servicio',
    loadTransform: v => (v ?? '').trim(),
    saveTransform: v => v.trim(),
    validate: (val) => {
      if (!val) return 'Debes ingresar una URL.';
      try {
        const u = new URL(val);
        if (!/^https?:$/.test(u.protocol)) return 'La URL debe iniciar con http:// o https://';
      } catch (e) {
        return 'La URL no es válida.';
      }
      return null;
    }
  },
  {
    code: 'HORA_CARGUE_FULL',
    input: '#param-hora-full',
    button: '#btn-guardar-hora-full',
    desc: 'Hora del cargue diario FULL',
    loadTransform: v => {
      const raw = (v ?? '').trim();
      if (!raw) return '';
      const m = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
      return m ? `${m[1]}:${m[2]}` : '';
    },
    saveTransform: v => {
      const t = v.trim();
      if (!t) return '';
      const m = t.match(/^(\d{2}):(\d{2})$/);
      return m ? `${m[1]}:${m[2]}:00` : t;
    },
    validate: (val) => {
      if (!val) return 'Debes seleccionar una hora.';
      if (!/^\d{2}:\d{2}$/.test(val)) return 'Formato de hora inválido.';
      return null;
    }
  },
  {
    code: 'FRECUENCIA_CARGUE_HORAS',
    input: '#param-frecuencia',
    button: '#btn-guardar-frecuencia',
    desc: 'Frecuencia del cargue periódico en horas',
    loadTransform: v => (v ?? '').toString().trim(),
    saveTransform: v => v.trim(),
    validate: (val) => {
      if (val === '') return 'Debes ingresar la frecuencia en horas.';
      const n = Number(val);
      if (!Number.isInteger(n)) return 'La frecuencia debe ser un entero.';
      if (n < 3) return 'La frecuencia mínima es de 3 horas.';
      return null;
    }
  },
  {
    code: 'APIKEY',
    input: '#param-apikey',
    button: '#btn-guardar-apikey',
    desc: 'API Key',
    loadTransform: v => (v ?? '').trim(),
    saveTransform: v => v.trim(),
    validate: (val) => {
      if (!val) return 'Debes ingresar la API Key.';
      return null;
    }
  },
  {
    code: 'REINTENTOS_API',
    input: '#param-reintentos',
    button: '#btn-guardar-reintentos',
    desc: 'Número de reintentos automáticos',
    loadTransform: v => (v ?? '').toString().trim(),
    saveTransform: v => v.trim(),
    validate: (val) => {
      if (val === '') return 'Debes ingresar el número de reintentos.';
      const n = Number(val);
      if (!Number.isInteger(n) || n < 0) return 'Los reintentos deben ser un entero ≥ 0.';
      return null;
    }
  },
  {
    code: 'TIEMPO_ENTRE_REINTENTOS',
    input: '#param-tiempo-reintentos',
    button: '#btn-guardar-tiempo-reintentos',
    desc: 'Tiempo entre reintentos automáticos (minutos)',
    loadTransform: v => (v ?? '').toString().trim(),
    saveTransform: v => v.trim(),
    validate: (val) => {
      if (val === '') return 'Debes ingresar el tiempo entre reintentos.';
      const n = Number(val);
      if (!Number.isInteger(n)) return 'El tiempo entre reintentos debe ser un entero.';
      if (n < 1 || n > 60) return 'El tiempo entre reintentos debe estar entre 1 y 60 minutos.';
      return null;
    }
  },
];

// Estado de selección (almacenado como string normalizado: codes ordenados separados por ;)
let empresaSeleccionInicialNorm = '';
let $tablaEmpresasBody = null;

let bodegaSeleccionInicialNorm = '';
let $tablaBodegasBody = null;

let precioSeleccionInicialNorm = '';
let $tablaPreciosBody = null;

// ===== Utilidades de selección múltiple =====
function parseSeleccionToSet(valorStr) {
  return new Set(
    String(valorStr)
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  );
}

function normalizeSeleccion(set) {
  return Array.from(set).sort().join(';');
}

$(document).ready(function () {
  PARAMS.forEach(setupParam);

  $tablaEmpresasBody = $('#tabla-empresas tbody');
  $tablaBodegasBody  = $('#tabla-bodegas tbody');
  $tablaPreciosBody  = $('#tabla-precios tbody');

  cargarEmpresasYSeleccion();

  $('#btn-guardar-empresas').on('click', guardarEmpresasSeleccionadas);
  $('#btn-guardar-bodegas').on('click', guardarBodegasSeleccionadas);
  $('#btn-guardar-precios').on('click', guardarPreciosSeleccionados);
});


function setupParam(def) {
  const $input = $(def.input);
  const $btn   = $(def.button);

  let initial = '';

  $.ajax({
    url: ENDPOINT_GET,
    method: 'POST',
    dataType: 'json',
    data: { codigo: def.code }
  })
  .done(function (resp) {
    if (resp.statusCode === 200 && resp.parametro) {
      const val = def.loadTransform(resp.parametro.valor);
      $input.val(val);
      initial = val;
      $btn.prop('disabled', true);
    } else if (resp.statusCode === 404) {
      initial = '';
      $btn.prop('disabled', true);
    } else if (resp.statusCode === 409) {
      error(`Existen múltiples vigentes para ${def.code}. Corrige la inconsistencia.`);
    } else {
      error(resp.mensaje || `No se pudo cargar el parámetro ${def.code}.`);
    }
  })
  .fail(function () {
    error(`Fallo al obtener el parámetro ${def.code}.`);
  });

  $input.on('input change', function () {
    const current = $input.val().trim();
    $btn.prop('disabled', current === initial);
  });

  $btn.on('click', function () {
    const raw = $input.val();
    const msg = def.validate(raw);
    if (msg) { warn(msg); return; }

    const toSave = def.saveTransform(raw);

    $.ajax({
      url: ENDPOINT_SAVE,
      method: 'POST',
      dataType: 'json',
      data: {
        codigo: def.code,
        descripcion: def.desc,
        valor: toSave
      }
    })
    .done(function (resp) {
      if (resp.statusCode === 200) {
        ok('Parámetro guardado correctamente.');
        initial = (def.loadTransform === undefined) ? toSave : def.loadTransform(toSave);
        $btn.prop('disabled', true);
      } else {
        error(resp.mensaje || `No se pudo guardar ${def.code}.`);
      }
    })
    .fail(function () {
      error(`Fallo al guardar el parámetro ${def.code}.`);
    });
  });
}

/* ===============================
   EMPRESAS (selección MÚLTIPLE con checkbox)
   =============================== */
function cargarEmpresasYSeleccion() {
  $.ajax({
    url: ENDPOINT_GET,
    method: 'POST',
    dataType: 'json',
    data: { codigo: PARAM_EMPRESAS }
  })
  .done(function (respParam) {
    let selSet = new Set();
    if (respParam.statusCode === 200 && respParam.parametro && respParam.parametro.valor) {
      selSet = parseSeleccionToSet(respParam.parametro.valor);
      empresaSeleccionInicialNorm = normalizeSeleccion(selSet);
    } else if (respParam.statusCode === 404) {
      empresaSeleccionInicialNorm = '';
    } else if (respParam.statusCode === 409) {
      error('Existen múltiples parámetros vigentes para EMPRESA. Corrige la inconsistencia.');
      return;
    } else if (respParam.statusCode && respParam.statusCode !== 200) {
      error(respParam.mensaje || 'No se pudo cargar las empresas parametrizadas.');
      return;
    }

    $.ajax({
      url: ENDPOINT_LISTAR_EMPRESAS,
      method: 'POST',
      dataType: 'json'
    })
    .done(function (respEmp) {
      if (respEmp.statusCode === 200 && Array.isArray(respEmp.empresas)) {
        renderTablaEmpresas(respEmp.empresas, selSet);
        $('#btn-guardar-empresas').prop('disabled', true);
        cargarBodegasYSeleccion();
        cargarPreciosYSeleccion();
      } else {
        error(respEmp.mensaje || 'No se pudieron cargar las empresas.');
      }
    })
    .fail(function () {
      error('Fallo al comunicarse con el servidor al listar empresas.');
    });
  })
  .fail(function () {
    error('Fallo al obtener el parámetro EMPRESA.');
  });
}

function renderTablaEmpresas(empresas, selSet) {
  $tablaEmpresasBody.empty();

  empresas.forEach(e => {
    const code = String(e.emprcod);
    const row = $(`
      <tr data-cod="${escapeHtml(code)}">
        <td class="text-monospace">${escapeHtml(code)}</td>
        <td>${escapeHtml(String(e.emprnom))}</td>
        <td>
          <input type="checkbox" class="form-check-input empresa-check">
        </td>
      </tr>
    `);
    row.find('input.empresa-check').prop('checked', selSet.has(code));

    row.find('input.empresa-check').on('change', function () {
      const currentNorm = normalizeSeleccion(getEmpresasSeleccionadas());
      $('#btn-guardar-empresas').prop('disabled', currentNorm === empresaSeleccionInicialNorm);
      // Limpiar bodegas y precios hasta que se guarde la nueva selección de empresas
      $tablaBodegasBody.empty();
      $('#btn-guardar-bodegas').prop('disabled', true);
      $tablaPreciosBody.empty();
      $('#btn-guardar-precios').prop('disabled', true);
      info('Guarda las empresas para cargar sus bodegas y listas de precios.');
    });

    $tablaEmpresasBody.append(row);
  });
}

function getEmpresasSeleccionadas() {
  const set = new Set();
  $tablaEmpresasBody.find('tr').each(function () {
    if ($(this).find('input.empresa-check').is(':checked')) {
      set.add(String($(this).data('cod')));
    }
  });
  return set;
}

function guardarEmpresasSeleccionadas() {
  const set = getEmpresasSeleccionadas();
  if (set.size === 0) { warn('Debes seleccionar al menos una empresa.'); return; }

  const valor = normalizeSeleccion(set);

  $.ajax({
    url: ENDPOINT_SAVE,
    method: 'POST',
    dataType: 'json',
    data: {
      codigo: PARAM_EMPRESAS,
      descripcion: 'Empresas habilitadas (emprcod separados por ;)',
      valor: valor
    }
  })
  .done(function (resp) {
    if (resp.statusCode === 200) {
      ok('Empresas guardadas correctamente.');
      empresaSeleccionInicialNorm = valor;
      $('#btn-guardar-empresas').prop('disabled', true);
      cargarBodegasYSeleccion();
      cargarPreciosYSeleccion();
    } else {
      error(resp.mensaje || 'No se pudieron guardar las empresas.');
    }
  })
  .fail(function () {
    error('Fallo al comunicarse con el servidor al guardar las empresas.');
  });
}

/* ===============================
   BODEGAS (selección MÚLTIPLE con checkbox, filtradas por empresa)
   =============================== */
function cargarBodegasYSeleccion() {
  $.ajax({
    url: ENDPOINT_GET,
    method: 'POST',
    dataType: 'json',
    data: { codigo: PARAM_BODEGAS }
  })
  .done(function (respParam) {
    let selSet = new Set();
    if (respParam.statusCode === 200 && respParam.parametro && respParam.parametro.valor) {
      selSet = parseSeleccionToSet(respParam.parametro.valor);
      bodegaSeleccionInicialNorm = normalizeSeleccion(selSet);
    } else if (respParam.statusCode === 404) {
      bodegaSeleccionInicialNorm = '';
    } else if (respParam.statusCode === 409) {
      error('Existen múltiples parámetros vigentes para BODEGA. Corrige la inconsistencia.');
      return;
    } else if (respParam.statusCode && respParam.statusCode !== 200) {
      error(respParam.mensaje || 'No se pudo cargar las bodegas parametrizadas.');
      return;
    }

    $.ajax({
      url: ENDPOINT_LISTAR_BODEGAS,
      method: 'POST',
      dataType: 'json'
    })
    .done(function (respBod) {
      if (respBod.statusCode === 200 && Array.isArray(respBod.bodegas)) {
        renderTablaBodegas(respBod.bodegas, selSet);
        $('#btn-guardar-bodegas').prop('disabled', true);
      } else {
        error(respBod.mensaje || 'No se pudieron cargar las bodegas.');
      }
    })
    .fail(function () {
      error('Fallo al comunicarse con el servidor al listar bodegas.');
    });
  })
  .fail(function () {
    error('Fallo al obtener el parámetro BODEGA.');
  });
}

function renderTablaBodegas(bodegas, selSet) {
  $tablaBodegasBody.empty();

  bodegas.forEach(b => {
    const bod = String(b.bodcod);
    const row = $(`
      <tr data-bod="${escapeHtml(bod)}">
        <td>${escapeHtml(String(b.emprnom))}</td>
        <td class="text-monospace">${escapeHtml(bod)}</td>
        <td>${escapeHtml(String(b.bodnom))}</td>
        <td>
          <input type="checkbox" class="form-check-input bodega-check">
        </td>
      </tr>
    `);
    row.find('input.bodega-check').prop('checked', selSet.has(bod));

    row.find('input.bodega-check').on('change', function () {
      const currentNorm = normalizeSeleccion(getBodegasSeleccionadas());
      $('#btn-guardar-bodegas').prop('disabled', currentNorm === bodegaSeleccionInicialNorm);
    });

    $tablaBodegasBody.append(row);
  });
}

function getBodegasSeleccionadas() {
  const set = new Set();
  $tablaBodegasBody.find('tr').each(function () {
    if ($(this).find('input.bodega-check').is(':checked')) {
      set.add(String($(this).data('bod')));
    }
  });
  return set;
}

function guardarBodegasSeleccionadas() {
  const set = getBodegasSeleccionadas();
  if (set.size === 0) { warn('Debes seleccionar al menos una bodega.'); return; }

  const valor = normalizeSeleccion(set);

  $.ajax({
    url: ENDPOINT_SAVE,
    method: 'POST',
    dataType: 'json',
    data: {
      codigo: PARAM_BODEGAS,
      descripcion: 'Bodegas habilitadas (bodcod separados por ;)',
      valor: valor
    }
  })
  .done(function (resp) {
    if (resp.statusCode === 200) {
      ok('Bodegas guardadas correctamente.');
      bodegaSeleccionInicialNorm = valor;
      $('#btn-guardar-bodegas').prop('disabled', true);
    } else {
      error(resp.mensaje || 'No se pudieron guardar las bodegas.');
    }
  })
  .fail(function () {
    error('Fallo al comunicarse con el servidor al guardar las bodegas.');
  });
}

/* ===============================
   PRECIOS (selección MÚLTIPLE con checkbox, filtrados por empresa)
   =============================== */
function cargarPreciosYSeleccion() {
  $.ajax({
    url: ENDPOINT_GET,
    method: 'POST',
    dataType: 'json',
    data: { codigo: PARAM_PRECIOS }
  })
  .done(function (respParam) {
    let selSet = new Set();
    if (respParam.statusCode === 200 && respParam.parametro && respParam.parametro.valor) {
      selSet = parseSeleccionToSet(respParam.parametro.valor);
      precioSeleccionInicialNorm = normalizeSeleccion(selSet);
    } else if (respParam.statusCode === 404) {
      precioSeleccionInicialNorm = '';
    } else if (respParam.statusCode === 409) {
      error('Existen múltiples parámetros vigentes para PRECIOS. Corrige la inconsistencia.');
      return;
    } else if (respParam.statusCode && respParam.statusCode !== 200) {
      error(respParam.mensaje || 'No se pudo cargar las listas de PRECIOS parametrizadas.');
      return;
    }

    $.ajax({
      url: ENDPOINT_LISTAR_PRECIOS,
      method: 'POST',
      dataType: 'json'
    })
    .done(function (resp) {
      if (resp.statusCode === 200 && Array.isArray(resp.precios)) {
        renderTablaPrecios(resp.precios, selSet);
        $('#btn-guardar-precios').prop('disabled', true);
      } else {
        error(resp.mensaje || 'No se pudieron cargar las listas de PRECIOS.');
      }
    })
    .fail(function () {
      error('Fallo al comunicarse con el servidor al listar PRECIOS.');
    });
  })
  .fail(function () {
    error('Fallo al obtener el parámetro PRECIOS.');
  });
}

function renderTablaPrecios(precios, selSet) {
  $tablaPreciosBody.empty();

  precios.forEach(p => {
    const tabpreid = String(p.tabpreid);
    const nombre = p.tabprenom || `Precio ${tabpreid}`;
    const row = $(`
      <tr data-pre="${escapeHtml(tabpreid)}">
        <td>${escapeHtml(String(p.emprnom || ''))}</td>
        <td class="text-monospace">${escapeHtml(tabpreid)}</td>
        <td>${escapeHtml(String(nombre))}</td>
        <td>
          <input type="checkbox" class="form-check-input precio-check">
        </td>
      </tr>
    `);
    row.find('input.precio-check').prop('checked', selSet.has(tabpreid));

    row.find('input.precio-check').on('change', function () {
      const currentNorm = normalizeSeleccion(getPreciosSeleccionados());
      $('#btn-guardar-precios').prop('disabled', currentNorm === precioSeleccionInicialNorm);
    });

    $tablaPreciosBody.append(row);
  });
}

function getPreciosSeleccionados() {
  const set = new Set();
  $tablaPreciosBody.find('tr').each(function () {
    if ($(this).find('input.precio-check').is(':checked')) {
      set.add(String($(this).data('pre')));
    }
  });
  return set;
}

function guardarPreciosSeleccionados() {
  const set = getPreciosSeleccionados();
  if (set.size === 0) { warn('Debes seleccionar al menos una lista de PRECIOS.'); return; }

  const valor = normalizeSeleccion(set);

  $.ajax({
    url: ENDPOINT_SAVE,
    method: 'POST',
    dataType: 'json',
    data: {
      codigo: PARAM_PRECIOS,
      descripcion: 'Listas de PRECIOS habilitadas (tabpreid separados por ;)',
      valor: valor
    }
  })
  .done(function (resp) {
    if (resp.statusCode === 200) {
      ok('Listas de PRECIOS guardadas correctamente.');
      precioSeleccionInicialNorm = valor;
      $('#btn-guardar-precios').prop('disabled', true);
    } else {
      error(resp.mensaje || 'No se pudieron guardar las listas de PRECIOS.');
    }
  })
  .fail(function () {
    error('Fallo al comunicarse con el servidor al guardar las listas de PRECIOS.');
  });
}

// Notificaciones
function ok(msg)   { if (window.Swal) Swal.fire('Éxito',       msg, 'success'); else alert(msg); }
function info(msg) { if (window.Swal) Swal.fire('Información', msg, 'info');    else alert(msg); }
function warn(msg) { if (window.Swal) Swal.fire('Atención',    msg, 'warning'); else alert(msg); }
function error(msg){ if (window.Swal) Swal.fire('Error',       msg, 'error');   else alert(msg); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"'`=\/]/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c];
  });
}
