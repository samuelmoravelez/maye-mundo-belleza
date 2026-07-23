import{f as c}from"./productos.data-CR48lO6O.js";function I(){const t=document.getElementById("btn-menu"),a=document.getElementById("menu-principal");!t||!a||(t.addEventListener("click",()=>{const e=a.classList.toggle("abierto");t.classList.toggle("abierto",e),t.setAttribute("aria-expanded",e)}),a.querySelectorAll("a").forEach(e=>{e.addEventListener("click",()=>{a.classList.remove("abierto"),t.classList.remove("abierto"),t.setAttribute("aria-expanded","false")})}))}const y="maye_carrito";function n(){try{const t=localStorage.getItem(y);return t?JSON.parse(t):[]}catch{return[]}}function d(t){localStorage.setItem(y,JSON.stringify(t)),window.dispatchEvent(new CustomEvent("carrito-actualizado",{detail:{items:t}}))}function F({id:t,nombre:a,precio:e,imagen:i}){const r=n(),o=r.findIndex(L=>L.id===t);o!==-1?r[o].cantidad+=1:r.push({id:t,nombre:a,precio:e,imagen:i,cantidad:1}),d(r)}function $(t){d(n().filter(a=>a.id!==t))}function g(t,a){const e=n(),i=e.findIndex(r=>r.id===t);i!==-1&&(a<=0?e.splice(i,1):e[i].cantidad=a,d(e))}function A(){d([])}function C(){return n().reduce((t,a)=>t+a.cantidad,0)}function w(){return n().reduce((t,a)=>t+a.precio*a.cantidad,0)}function M(){const t=n();if(t.length===0)return null;const a=t.map(r=>`• ${r.nombre} (${r.cantidad}) — ${c(r.precio*r.cantidad)}`),e=c(w()),i=["Hola, Maye Mundo Belleza.","","Quisiera realizar el siguiente pedido:","",...a,"",`Total: ${e}`,"","Muchas gracias."].join(`
`);return encodeURIComponent(i)}const x="573003091641";let l,u,s,v,_,E,h,b;function k(){B(),T(),S(),m(),window.addEventListener("carrito-actualizado",()=>{f(),m()}),window.addEventListener("storage",t=>{t.key==="maye_carrito"&&(f(),m())})}function B(){document.getElementById("carrito-overlay")||document.body.insertAdjacentHTML("beforeend",`
        <div class="carrito-overlay" id="carrito-overlay"></div>

        <aside class="carrito-drawer" id="carrito-drawer" aria-label="Carrito de compras" role="complementary">
            <div class="carrito-drawer__header">
                <span class="carrito-drawer__titulo">
                    <i class="ri-shopping-bag-3-line"></i>
                    Mi Carrito
                    <span class="carrito-drawer__badge" id="carrito-badge-drawer">0</span>
                </span>
                <button class="carrito-drawer__cerrar" id="carrito-cerrar" aria-label="Cerrar carrito">
                    <i class="ri-close-line"></i>
                </button>
            </div>

            <div class="carrito-drawer__cuerpo" id="carrito-cuerpo">
                <!-- Items renderizados por JS -->
            </div>

            <div class="carrito-drawer__pie" id="carrito-pie" style="display:none">
                <div class="carrito-totales" id="carrito-totales"></div>
                <div class="carrito-drawer__acciones">
                    <button class="btn-pedir-whatsapp" id="btn-pedir-whatsapp">
                        <i class="ri-whatsapp-line"></i>
                        Realizar pedido por WhatsApp
                    </button>
                    <button class="btn-vaciar-carrito" id="btn-vaciar-carrito">
                        <i class="ri-delete-bin-line"></i>
                        Vaciar carrito
                    </button>
                </div>
            </div>
        </aside>
    `)}function T(){l=document.getElementById("carrito-overlay"),u=document.getElementById("carrito-drawer"),s=document.getElementById("carrito-cuerpo"),v=document.getElementById("carrito-badge-drawer"),_=document.getElementById("carrito-cerrar"),E=document.getElementById("btn-vaciar-carrito"),h=document.getElementById("btn-pedir-whatsapp"),b=document.getElementById("carrito-pie"),document.querySelectorAll(".contador-carrito")}function S(){document.addEventListener("click",t=>{t.target.closest(".icono-carrito")&&(t.preventDefault(),z())}),_.addEventListener("click",p),l.addEventListener("click",p),document.addEventListener("keydown",t=>{t.key==="Escape"&&u.classList.contains("abierto")&&p()}),E.addEventListener("click",()=>{A()}),h.addEventListener("click",()=>{const t=M();t&&window.open(`https://wa.me/${x}?text=${t}`,"_blank","noopener,noreferrer")})}function z(){f(),u.classList.add("abierto"),l.classList.add("visible"),document.body.style.overflow="hidden",_.focus()}function p(){u.classList.remove("abierto"),l.classList.remove("visible"),document.body.style.overflow=""}function f(){const t=n();if(t.length===0){s.innerHTML=`
            <div class="carrito-vacio">
                <i class="ri-shopping-bag-3-line carrito-vacio__icono"></i>
                <p class="carrito-vacio__titulo">Tu carrito está vacío</p>
                <p class="carrito-vacio__texto">Agrega productos desde nuestro catálogo y aparecerán aquí.</p>
                <a href="/paginas/productos.html" class="carrito-vacio__btn"
                   onclick="cerrarDrawer()">
                    <i class="ri-store-2-line"></i> Ver catálogo
                </a>
            </div>`,b.style.display="none";return}s.innerHTML=t.map(a=>H(a)).join(""),b.style.display="flex",j(t),s.querySelectorAll("[data-accion-carrito]").forEach(a=>{a.addEventListener("click",()=>{const e=a.dataset.accionCarrito,i=Number(a.dataset.id);if(e==="eliminar"&&$(i),e==="incrementar"){const r=n().find(o=>o.id===i);r&&g(i,r.cantidad+1)}if(e==="decrementar"){const r=n().find(o=>o.id===i);r&&g(i,r.cantidad-1)}})})}function H(t){const a=c(t.precio*t.cantidad),e=c(t.precio),i=t.imagen||"https://placehold.co/72x72/FAF7F2/2A8C64?text=Maye";return`
    <div class="carrito-item" data-item-id="${t.id}">
        <img src="${i}" alt="${t.nombre}" class="carrito-item__imagen"
             onerror="this.src='https://placehold.co/72x72/FAF7F2/2A8C64?text=Maye'">

        <div class="carrito-item__info">
            <span class="carrito-item__nombre">${t.nombre}</span>
            <span class="carrito-item__precio-unit">${e} c/u</span>
            <div class="carrito-item__controles">
                <button class="carrito-item__btn-cant"
                        data-accion-carrito="decrementar" data-id="${t.id}"
                        aria-label="Reducir cantidad">
                    <i class="ri-subtract-line"></i>
                </button>
                <span class="carrito-item__cantidad">${t.cantidad}</span>
                <button class="carrito-item__btn-cant"
                        data-accion-carrito="incrementar" data-id="${t.id}"
                        aria-label="Aumentar cantidad">
                    <i class="ri-add-line"></i>
                </button>
            </div>
        </div>

        <div class="carrito-item__acciones">
            <button class="carrito-item__eliminar"
                    data-accion-carrito="eliminar" data-id="${t.id}"
                    aria-label="Eliminar ${t.nombre} del carrito">
                <i class="ri-close-line"></i>
            </button>
            <span class="carrito-item__subtotal">${a}</span>
        </div>
    </div>`}function j(t){const a=w(),e=a;document.getElementById("carrito-totales").innerHTML=`
        <div class="carrito-totales__fila">
            <span>${t.length} producto${t.length!==1?"s":""}</span>
            <span>${c(a)}</span>
        </div>
        <div class="carrito-totales__fila">
            <span>Envío</span>
            <span style="color:var(--verde-principal);font-weight:600">A coordinar</span>
        </div>
        <div class="carrito-totales__fila carrito-totales__fila--total">
            <span>Total estimado</span>
            <span>${c(e)}</span>
        </div>`}function m(){const t=C();document.querySelectorAll(".contador-carrito").forEach(a=>{a.textContent=t,t>0&&(a.classList.add("bump"),setTimeout(()=>a.classList.remove("bump"),400))}),v&&(v.textContent=t)}document.addEventListener("DOMContentLoaded",()=>{I(),k()});export{F as a};
