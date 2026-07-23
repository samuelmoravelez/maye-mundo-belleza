import{o as b,E as v,f as l}from"./productos.data-CR48lO6O.js";import{a as f}from"./main-B2G__6RL.js";/* empty css              */let p=[],c="todos",n="",r=null,g=null,i=null;function L(){r=document.getElementById("grilla-catalogo"),g=document.getElementById("contador-resultados"),i=document.getElementById("busqueda-catalogo"),r&&(T(),u(),document.querySelectorAll("[data-categoria]").forEach(a=>{a.addEventListener("click",()=>{c=a.dataset.categoria,document.querySelectorAll("[data-categoria]").forEach(t=>t.classList.remove("activo")),document.querySelectorAll(`[data-categoria="${c}"]`).forEach(t=>t.classList.add("activo")),m()})}),i&&i.addEventListener("input",()=>{n=i.value.toLowerCase().trim(),m()}),r.addEventListener("click",a=>{const t=a.target.closest("[data-btn-carrito]");if(!t)return;const e=Number(t.dataset.id),o=t.dataset.nombre,s=Number(t.dataset.precio),d=t.dataset.imagen;f({id:e,nombre:o,precio:s,imagen:d}),y(`${o} agregado al carrito`),A(t)}),window.addEventListener("productos-actualizados",u),window.addEventListener("storage",a=>{a.key==="maye_productos"&&u()}))}function u(){p=b().filter(a=>a.visible),m()}function m(){const a=p.filter(t=>{const e=c==="todos"||t.categoria===c,o=!n||t.nombre.toLowerCase().includes(n)||t.categoria.toLowerCase().includes(n);return e&&o});if(g&&(g.textContent=`${a.length} producto${a.length!==1?"s":""}`),a.length===0){r.innerHTML=`
            <div class="catalogo-vacio">
                <i class="ri-search-line catalogo-vacio__icono"></i>
                <p class="catalogo-vacio__texto">No encontramos productos con ese criterio.</p>
                <button class="catalogo-vacio__btn" onclick="location.reload()">Ver todos</button>
            </div>`;return}r.innerHTML=a.map((t,e)=>$(t)).join(""),r.querySelectorAll(".tarjeta-producto").forEach((t,e)=>{t.style.animationDelay=`${e*.07}s`,t.classList.add("tarjeta-animada")})}function $(a){const t=a.stock===0||a.etiqueta==="agotado",e=a.etiqueta&&v[a.etiqueta];`${a.whatsapp||encodeURIComponent(`Hola! Me interesa el producto ${a.nombre}`)}`;const o=e?`<span class="etiqueta-producto ${e.clase}">${e.texto}</span>`:"",s=a.precioAnterior?`<div class="precio-wrapper">
               <span class="precio-producto">${l(a.precio)}</span>
               <span class="precio-anterior">${l(a.precioAnterior)}</span>
           </div>`:`<div class="precio-wrapper">
               <span class="precio-producto">${l(a.precio)}</span>
           </div>`,d=t?`<button class="btn-comprar-tarjeta" disabled aria-disabled="true">
               <span><i class="ri-close-circle-line"></i> Agotado</span>
           </button>`:`<button class="btn-comprar-tarjeta"
               data-btn-carrito
               data-id="${a.id}"
               data-nombre="${a.nombre.replace(/"/g,"&quot;")}"
               data-precio="${a.precio}"
               data-imagen="${a.imagen}"
               aria-label="Agregar ${a.nombre} al carrito">
               <span><i class="ri-shopping-bag-3-line"></i> Agregar al carrito</span>
           </button>`;return`
    <article class="tarjeta-producto${t?" agotada":""}" data-id="${a.id}">
        <div class="imagen-producto-wrapper">
            <img src="${a.imagen}"
                 alt="${a.nombre}"
                 class="imagen-producto"
                 loading="lazy"
                 onerror="this.src='https://placehold.co/400x400/FAF7F2/2A8C64?text=Maye'">
            ${o}
            ${t?'<div class="overlay-agotado"><span>Agotado</span></div>':""}
        </div>
        <div class="info-producto">
            <span class="categoria-tag">${h(a.categoria)}</span>
            <h3 class="nombre-producto">${a.nombre}</h3>
            ${s}
            ${d}
        </div>
    </article>`}const E={capilar:"Cuidado Capilar",maquillaje:"Maquillaje",unas:"Uñas",skincare:"Skincare",todos:"General"};function h(a){return E[a]??a}function T(){if(document.getElementById("catalogo-toast-container"))return;const a=document.createElement("div");a.id="catalogo-toast-container",a.className="toast-container",document.body.appendChild(a)}function y(a){const t=document.getElementById("catalogo-toast-container");if(!t)return;const e=document.createElement("div");e.className="toast",e.innerHTML=`
        <i class="ri-shopping-bag-3-line toast__icono"></i>
        <span>${a}</span>`,t.appendChild(e),setTimeout(()=>{e.classList.add("saliendo"),setTimeout(()=>e.remove(),300)},2800)}function A(a){if(a.disabled)return;const t=a.innerHTML;a.innerHTML='<span><i class="ri-check-line"></i> Agregado</span>',a.classList.add("btn-comprar-tarjeta--agregado"),a.disabled=!0,setTimeout(()=>{a.innerHTML=t,a.classList.remove("btn-comprar-tarjeta--agregado"),a.disabled=!1},1500)}document.addEventListener("DOMContentLoaded",()=>{L()});
