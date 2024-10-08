document.addEventListener('DOMContentLoaded', () => {
    // Intentar obtener la ubicación del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                // URL de la API con la ubicación del usuario
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

                obtenerDatosClimaticos(url, latitude, longitude);
                obtenerLugaresDeInteres(latitude, longitude);
            },
            (error) => {
                console.error('Error obteniendo la ubicación:', error);
                const faseLunarDiv = document.getElementById('fases-lunares');
                if (faseLunarDiv) {
                    faseLunarDiv.innerText = 'No se pudo obtener la ubicación. Asegúrate de permitir el acceso a la ubicación.';
                }
            }
        );
    } else {
        const faseLunarDiv = document.getElementById('fases-lunares');
        if (faseLunarDiv) {
            faseLunarDiv.innerText = 'Geolocalización no es soportada por este navegador.';
        }
    }
});

function obtenerDatosClimaticos(url, latitude, longitude) {
    let clima; // Definir la variable 'clima' fuera del scope del fetch
    let ubicacion; // Definir la variable 'ubicacion' para almacenar la información de ubicación

    // Llamar a la API de Open Meteo
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la solicitud a la API: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Datos del clima:", data);
            clima = data.daily;
            // Llamar a la API de geocodificación inversa para obtener el país, ciudad y comuna
            return fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener la ubicación: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Datos de la ubicación:", data);
            ubicacion = data;
            // Ahora vamos a cargar la información de las fases lunares
            return fetch('fases_lunares.json');
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar las fases lunares: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(fasesData => {
            console.log("Datos de las fases lunares:", fasesData);
            mostrarPronosticoYRecomendaciones(fasesData, clima, latitude, longitude, ubicacion);
            mostrarGraficoTemperatura(clima);
        })
        .catch(error => {
            console.error('Error al obtener los datos:', error);
            const faseLunarDiv = document.getElementById('fases-lunares');
            if (faseLunarDiv) {
                faseLunarDiv.innerText = `Hubo un error al obtener los datos: ${error.message}`;
            }
        });
}

function obtenerLugaresDeInteres(latitude, longitude) {
    const query = `
        [out:json];
        (
          node["tourism"="attraction"](around:5000, ${latitude}, ${longitude});
          way["tourism"="attraction"](around:5000, ${latitude}, ${longitude});
          relation["tourism"="attraction"](around:5000, ${latitude}, ${longitude});
        );
        out center;`;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener los lugares de interés: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Lugares de interés:", data);
            mostrarLugaresDeInteres(data.elements);
        })
        .catch(error => {
            console.error('Error al obtener los lugares de interés:', error);
            const contenedor = document.getElementById('lugares-lista');
            if (contenedor) {
                const errorMensaje = document.createElement('p');
                errorMensaje.textContent = `No se pudieron obtener los lugares de interés: ${error.message}`;
                contenedor.appendChild(errorMensaje);
            }
        });
}

function mostrarLugaresDeInteres(lugares) {
    const contenedor = document.getElementById('lugares-lista');
    if (!contenedor) return;
    contenedor.innerHTML = ''; // Limpiar cualquier mensaje anterior

    lugares.forEach(lugar => {
        const tipoElemento = lugar.type;
        const id = lugar.id;
        const enlaceOSM = `https://www.openstreetmap.org/${tipoElemento}/${id}`;
        let enlace = enlaceOSM;
        let nombreLugar = lugar.tags.name || "Desconocido";

        // Verificar si tiene un identificador de Wikidata
        if (lugar.tags.wikidata) {
            const wikidataId = lugar.tags.wikidata;
            enlace = `https://www.wikidata.org/wiki/${wikidataId}`;
        }
        
        const lugarElemento = document.createElement('div');
        lugarElemento.className = 'lugares-interes';
        lugarElemento.innerHTML = `<strong>${nombreLugar}</strong> - Tipo: ${lugar.tags.tourism || "Desconocido"} <br> <a href="${enlace}" target="_blank">Ver más información</a>`;
        contenedor.appendChild(lugarElemento);
    });
}

function mostrarPronosticoYRecomendaciones(fasesData, clima, latitude, longitude, ubicacion) {
    const contenedor = document.getElementById('fases-lunares');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const hoy = new Date().toISOString().split('T')[0];

    // Buscar la fase lunar correspondiente a hoy
    const faseHoy = fasesData.fasesLunares.find(fase => fase.fecha === hoy);
    const faseLunar = faseHoy ? faseHoy.fase : "Desconocida";

    // Extraer información de ubicación (país, ciudad, comuna si está disponible)
    const pais = ubicacion.address.country || "Desconocido";
    const ciudad = ubicacion.address.city || ubicacion.address.town || ubicacion.address.village || "Desconocido";
    const comuna = ubicacion.address.suburb || "Desconocido";

    // Mostrar el pronóstico del clima, la fase lunar y la ubicación
    const temperaturaMax = clima.temperature_2m_max[0];
    const temperaturaMin = clima.temperature_2m_min[0];
    const precipitacion = clima.precipitation_sum[0];

    const pronostico = `
        <p>Fecha: ${hoy}</p>
        <p>Ubicación: ${comuna}, ${ciudad}, ${pais} (Latitud ${latitude.toFixed(2)}, Longitud ${longitude.toFixed(2)})</p>
        <p>Fase Lunar: ${faseLunar}</p>
        <p>Temperatura Máxima: ${temperaturaMax} °C</p>
        <p>Temperatura Mínima: ${temperaturaMin} °C</p>
        <p>Precipitación: ${precipitacion} mm</p>
    `;

    contenedor.innerHTML = pronostico;

    // Mostrar impacto de la fase lunar
    mostrarImpactoFaseLunar(faseLunar);

    // Mostrar la temperatura actual y su interpretación
    mostrarTemperaturaActual(temperaturaMax, temperaturaMin);

    // Mostrar descripción de la provincia
    mostrarDescripcionProvincia(ubicacion);

    // Añadir recomendaciones basadas en la fase lunar y el clima
    const recomendacion = document.createElement('p');
    recomendacion.className = 'recomendacion';
    recomendacion.textContent = obtenerRecomendacion(faseLunar, {
        precipitacion: precipitacion
    });
    contenedor.appendChild(recomendacion);
}

function mostrarImpactoFaseLunar(faseLunar) {
    const impactoFaseDiv = document.getElementById('impacto-fase');
    if (!impactoFaseDiv) return;
    let impactoTexto;

    switch (faseLunar) {
        case "Luna Nueva":
            impactoTexto = "La Luna Nueva es ideal para establecer intenciones y nuevos comienzos.";
            break;
        case "Cuarto Creciente":
            impactoTexto = "El Cuarto Creciente es un buen momento para tomar acción y avanzar hacia tus metas.";
            break;
        case "Luna Llena":
            impactoTexto = "La Luna Llena trae consigo una energía intensa, perfecta para celebrar logros y hacer balance.";
            break;
        case "Cuarto Menguante":
            impactoTexto = "El Cuarto Menguante es un momento para reflexionar y soltar aquello que ya no te sirve.";
            break;
        default:
            impactoTexto = "No hay información específica para esta fase lunar.";
    }

    impactoFaseDiv.innerHTML = `<p>${impactoTexto}</p>`;
}

function mostrarTemperaturaActual(temperaturaMax, temperaturaMin) {
    const temperaturaDiv = document.getElementById('temperatura-actual');
    if (!temperaturaDiv) return;
    const temperaturaMedia = (temperaturaMax + temperaturaMin) / 2;
    let descripcionTemperatura;

    if (temperaturaMedia >= 30) {
        descripcionTemperatura = "Caluroso";
    } else if (temperaturaMedia >= 20) {
        descripcionTemperatura = "Templado";
    } else if (temperaturaMedia >= 10) {
        descripcionTemperatura = "Fresco";
    } else {
        descripcionTemperatura = "Frío";
    }

    temperaturaDiv.innerHTML = `<p>${temperaturaMedia.toFixed(1)} °C - ${descripcionTemperatura}</p>`;
}

function mostrarDescripcionProvincia(ubicacion) {
    const descripcionDiv = document.getElementById('descripcion-provincia');
    if (!descripcionDiv) return;
    const provincia = ubicacion.address.state || "Desconocido";

    // Puedes agregar una lógica más detallada para obtener la descripción de la provincia desde alguna API o base de datos
    const descripcion = `La provincia de ${provincia} es conocida por su cultura y diversidad.`;

    descripcionDiv.innerHTML = `<p>${descripcion}</p>`;
}

function mostrarGraficoTemperatura(clima) {
    const ctx = document.getElementById('chartTemperatura');
    if (!ctx) return;
    const data = {
        labels: ['Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5', 'Día 6', 'Día 7'],
        datasets: [
            {
                label: 'Temperatura Máxima (°C)',
                data: clima.temperature_2m_max,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: false,
            },
            {
                label: 'Temperatura Mínima (°C)',
                data: clima.temperature_2m_min,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: false,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        scales: {
            x: {
                beginAtZero: true
            },
            y: {
                beginAtZero: true
            }
        }
    };

    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: data,
        options: options
    });
}

function obtenerRecomendacion(fase, clima) {
    let recomendacion = "";

    switch (fase) {
        case "Luna Nueva":
            if (clima.precipitacion > 0) {
                recomendacion = "Reflexiona y escribe tus objetivos en un lugar cómodo bajo techo.";
            } else {
                recomendacion = "Ideal para meditar al aire libre o hacer una caminata tranquila.";
            }
            break;

        case "Cuarto Creciente":
            if (clima.precipitacion > 0) {
                recomendacion = "Ideal para organizar y planificar proyectos de crecimiento en casa.";
            } else {
                recomendacion = "Perfecto para iniciar actividades físicas al aire libre, como correr.";
            }
            break;

        case "Luna Llena":
            if (clima.precipitacion > 0) {
                recomendacion = "Perfecto para una sesión de autocuidado: un baño relajante o yoga.";
            } else {
                recomendacion = "Excelente para celebrar logros con amigos o familia al aire libre.";
            }
            break;

        case "Cuarto Menguante":
            if (clima.precipitacion > 0) {
                recomendacion = "Reflexiona y escribe lo que deseas dejar ir, mientras estás en casa.";
            } else {
                recomendacion = "Sal al aire libre y reflexiona sobre lo que necesitas soltar.";
            }
            break;

        default:
            recomendacion = "No hay recomendaciones específicas para esta fase.";
    }

    return recomendacion;
}