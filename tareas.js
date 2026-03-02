// Clase para manejar IndexedDB
class TareasDB {
    constructor() {
        this.dbName = 'TareasDB';
        this.version = 2; // Incrementar versión para forzar actualización
        this.db = null;
    }

    // Inicializar base de datos
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Base de datos inicializada correctamente');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Eliminar store antiguo si existe (para limpiar datos viejos)
                if (db.objectStoreNames.contains('tareas')) {
                    db.deleteObjectStore('tareas');
                }
                
                // Crear nuevo store
                const store = db.createObjectStore('tareas', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                // Crear índices para búsquedas
                store.createIndex('vencimiento', 'vencimiento', { unique: false });
                store.createIndex('cumplida', 'cumplida', { unique: false });
                
                console.log('Estructura de base de datos actualizada');
            };
        });
    }

    // Obtener todas las tareas
    async getTareas() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tareas'], 'readonly');
            const store = transaction.objectStore('tareas');
            const request = store.getAll();

            request.onsuccess = () => {
                // Ordenar por fecha de vencimiento
                const tareas = request.result.sort((a, b) => 
                    new Date(a.vencimiento) - new Date(b.vencimiento)
                );
                resolve(tareas);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Agregar tarea
    async addTarea(tarea) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tareas'], 'readwrite');
            const store = transaction.objectStore('tareas');
            
            // Agregar timestamp de creación
            tarea.created_at = new Date().toISOString();
            
            const request = store.add(tarea);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Actualizar tarea
    async updateTarea(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tareas'], 'readwrite');
            const store = transaction.objectStore('tareas');
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const tarea = getRequest.result;
                if (!tarea) {
                    reject(new Error('Tarea no encontrada'));
                    return;
                }
                Object.assign(tarea, updates);
                
                const updateRequest = store.put(tarea);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Eliminar tarea
    async deleteTarea(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base de datos no inicializada'));
                return;
            }

            const transaction = this.db.transaction(['tareas'], 'readwrite');
            const store = transaction.objectStore('tareas');
            
            const deleteRequest = store.delete(id);
            
            deleteRequest.onsuccess = () => {
                console.log('Tarea eliminada correctamente:', id);
                resolve();
            };
            
            deleteRequest.onerror = () => {
                console.error('Error en deleteRequest:', deleteRequest.error);
                reject(deleteRequest.error);
            };
        });
    }

    // Marcar como cumplida/no cumplida
    async toggleCumplida(id, cumplida) {
        return this.updateTarea(id, { cumplida });
    }
}

// Inicializar base de datos
const db = new TareasDB();

// Elementos del DOM
const btnNuevaTarea = document.getElementById('btnNuevaTarea');
const btnVerTareas = document.getElementById('btnVerTareas');
const formularioTarea = document.getElementById('formularioTarea');
const listadoTareas = document.getElementById('listadoTareas');
const tareaForm = document.getElementById('tareaForm');
const btnCancelar = document.getElementById('btnCancelar');
const vencimientoInput = document.getElementById('vencimiento');
const horaPanel = document.getElementById('panelHora');
const tareasContainer = document.getElementById('tareasContainer');

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        console.log('Aplicación inicializada correctamente');
        
        // Establecer la fecha mínima en el input de fecha como hoy
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');
        const hoyStr = `${año}-${mes}-${dia}`;
        
        vencimientoInput.min = hoyStr;
        vencimientoInput.value = hoyStr;
        
        // Verificar si hay parámetros en la URL
        if (window.location.hash === '#tareas') {
            mostrarListado();
        }
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al inicializar la aplicación');
    }
});

// Event Listeners
btnNuevaTarea.addEventListener('click', mostrarFormulario);
btnVerTareas.addEventListener('click', mostrarListado);
btnCancelar.addEventListener('click', ocultarFormulario);
vencimientoInput.addEventListener('change', verificarFecha);
tareaForm.addEventListener('submit', guardarTarea);

// Función para verificar si la fecha seleccionada es hoy (VERSIÓN ULTRA CORREGIDA)
function verificarFecha() {
    const fechaSeleccionada = vencimientoInput.value;
    
    // Obtener fecha actual en formato local YYYY-MM-DD
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const hoyStr = `${año}-${mes}-${dia}`;
    
    console.log('Fecha seleccionada:', fechaSeleccionada);
    console.log('Fecha hoy:', hoyStr);
    console.log('¿Son iguales?', fechaSeleccionada === hoyStr);
    
    // Comparación directa de strings
    if (fechaSeleccionada === hoyStr) {
        console.log('ES HOY - Mostrando panel de hora');
        horaPanel.classList.remove('oculto');
    } else {
        console.log('NO ES HOY - Ocultando panel de hora');
        horaPanel.classList.add('oculto');
        document.getElementById('hora').value = '';
    }
}

// Función para mostrar formulario
function mostrarFormulario() {
    console.log('Mostrando formulario');
    formularioTarea.classList.add('formulario-visible');
    formularioTarea.classList.remove('formulario-oculto');
    listadoTareas.classList.add('listado-oculto');
    listadoTareas.classList.remove('listado-visible');
    tareaForm.reset();
    horaPanel.classList.add('oculto');
    
    // Establecer fecha actual por defecto
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    vencimientoInput.value = `${año}-${mes}-${dia}`;
     verificarFecha();
    // Actualizar hash en URL
    window.location.hash = '';
}

// Función para ocultar formulario
function ocultarFormulario() {
    console.log('Ocultando formulario');
    formularioTarea.classList.remove('formulario-visible');
    formularioTarea.classList.add('formulario-oculto');
}

// Función para mostrar listado
function mostrarListado() {
    console.log('Mostrando listado');
    listadoTareas.classList.add('listado-visible');
    listadoTareas.classList.remove('listado-oculto');
    formularioTarea.classList.remove('formulario-visible');
    formularioTarea.classList.add('formulario-oculto');
    
    // Actualizar hash en URL
    window.location.hash = '#tareas';
    
    cargarTareas();
}

// Función para guardar tarea
async function guardarTarea(e) {
    e.preventDefault();
    
    const tarea = document.getElementById('tarea').value;
    if (!tarea.trim()) {
        alert('Por favor ingresa una descripción para la tarea');
        return;
    }
    
    let fechaVencimiento = document.getElementById('vencimiento').value;
    const hora = document.getElementById('hora').value;
    
    // Validar fecha
    if (!fechaVencimiento) {
        alert('Por favor selecciona una fecha de vencimiento');
        return;
    }
    
    // Si hay hora seleccionada, agregarla a la fecha
    if (hora) {
        fechaVencimiento = `${fechaVencimiento}T${hora}:00`;
    } else {
        fechaVencimiento = `${fechaVencimiento}T23:59:59`;
    }
    
    try {
        const nuevaTarea = {
            tarea: tarea.trim(),
            vencimiento: fechaVencimiento,
            cumplida: false
        };
        
        console.log('Guardando tarea:', nuevaTarea);
        await db.addTarea(nuevaTarea);
        
        alert('Tarea guardada exitosamente');
        ocultarFormulario();
        tareaForm.reset();
        horaPanel.classList.add('oculto');
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar la tarea');
    }
}

// Función para cargar tareas
async function cargarTareas() {
    try {
        console.log('Cargando tareas...');
        const tareas = await db.getTareas();
        console.log('Tareas cargadas:', tareas);
        mostrarTareas(tareas);
    } catch (error) {
        console.error('Error al cargar tareas:', error);
        alert('Error al cargar las tareas');
    }
}

// Función para mostrar tareas en el grid
function mostrarTareas(tareas) {
    tareasContainer.innerHTML = '';
    
    if (tareas.length === 0) {
        tareasContainer.innerHTML = '<p class="sin-tareas">No hay tareas pendientes</p>';
        return;
    }
    
    tareas.forEach(tarea => {
        const estado = determinarEstado(tarea);
        const tarjeta = crearTarjetaTarea(tarea, estado);
        tareasContainer.appendChild(tarjeta);
    });
}

// Función para crear tarjeta de tarea (VERSIÓN MEJORADA)
function crearTarjetaTarea(tarea, estado) {
    const card = document.createElement('div');
    card.className = 'tarea-card';
    card.dataset.id = tarea.id;
    
    let iconoClass = '';
    let iconoIcon = '';
    
    switch(estado) {
        case 'vencida':
            iconoClass = 'icono-rojo';
            iconoIcon = 'fa-exclamation-circle';
            break;
        case 'pendiente':
            iconoClass = 'icono-verde';
            iconoIcon = 'fa-clock';
            break;
        case 'cumplida':
            iconoClass = 'icono-azul';
            iconoIcon = 'fa-check-circle';
            break;
    }
    
    const fecha = new Date(tarea.vencimiento);
    const fechaFormateada = fecha.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    card.innerHTML = `
        <div class="tarea-header">
            <i class="fas ${iconoIcon} estado-icono ${iconoClass}"></i>
            <span class="tarea-titulo">${tarea.tarea}</span>
        </div>
        <div class="tarea-fecha">
            <i class="fas fa-calendar-alt"></i> ${fechaFormateada}
        </div>
        <div class="tarea-acciones">
            <input type="checkbox" class="checkbox-cumplida" data-id="${tarea.id}" ${tarea.cumplida ? 'checked' : ''}>
            <button class="btn-eliminar" data-id="${tarea.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Agregar event listeners DIRECTAMENTE a los elementos
    const checkbox = card.querySelector('.checkbox-cumplida');
    checkbox.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        console.log('Checkbox clickeado - ID:', id, 'Valor:', this.checked);
        toggleCumplida(id, this.checked);
    });
    
    const btnEliminar = card.querySelector('.btn-eliminar');
    btnEliminar.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        console.log('Botón eliminar clickeado - ID:', id);
        Área eliminatoria(id);
    });
    
    retorno card;
}

// Función para determinar el estado de la tarea
función determinarEstado(tarea) {
    const ahora = nuevo Fecha();
    const vencimiento = nuevo Fecha(tarea.vencimiento);
    
    si (tarea.cumplida) {
        retorno 'cumplida';
    } else si (ahora > vencimiento) {
        retorno 'vencida';
    } else {
        retorno 'pendiente';
    }
}

// Función para marcar/desmarcar tarea como cumplida
async función alternarCumplida(id, cumplida) {
    consola.registro('Alternar cumplida - ID:', id, 'Cumplida:', cumplida);
    
    intentar {
        await db.alternarCumplida(id, cumplida);
        consola.registro('Estado actualizado, recargando tareas...');
        await CargarTareas();
    } atrapar (error) {
        consola.error('Error al actualizar:', error);
        alertaa('Error al actualizar la tarea');
        // Recargar para mantener consistencia
        await CargarTareas();
    }
}

// Función para eliminar tarea (VERSIÓN ULTRA CORREGIDA)
async función Área eliminatoria(id) {
    consola.registro('=== INICIO PROCESO DE ELIMINACIÓN ===');
    consola.registro('ID a eliminatorio:', id);
    consola.registro('Tipo de ID:', tipo de id);
    
    si (!confirmar('¿Está seguro de eliminar esta tarea?')) {
        consola.registro('Eliminación cancelada por el usuario');
        retorno;
    }
    
    intentar {
        consola.registro('Ejecutando db.deleteTarea...');
        await db.eliminar área(id);
        consola.registro('Tarea eliminada de la base de datos');
        
        consola.registro('Recargando lista de tareas...');
        await CargarTareas();
        
        consola.registro('=== PROCESO COMPLETO EXITOSAMENTE ===');
    } atrapar (error) {
        consola.error('=== ERROR EN EL PROCESO ===');
        consola.error('Error detallado:', error);
        consola.error('Mensaje:', error.mensaje);
        consola.error('Pila:', error.pila);
        alertaa('Error al eliminar la tarea: ' + error.mensaje);
    }
}

// Exponer funciones globales para depuración
ventana.Área eliminatoria = Área eliminatoria;
ventana.db = db;
ventana.CargarTareas = CargarTareas;
