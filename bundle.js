
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = cb => requestAnimationFrame(cb);

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value) {
        node.style.setProperty(key, value);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    function bind(component, name, callback) {
        if (component.$$.props.indexOf(name) === -1)
            return;
        component.$$.bound[name] = callback;
        callback(component.$$.ctx[name]);
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/Entry.svelte generated by Svelte v3.6.8 */

    const file = "src/Entry.svelte";

    function create_fragment(ctx) {
    	var div0, div0_intro, div0_outro, t0, div1, h20, t2, h21, t4, button, div1_intro, div1_outro, current, dispose;

    	return {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Добро пожаловать";
    			t2 = space();
    			h21 = element("h2");
    			h21.textContent = "В команду";
    			t4 = space();
    			button = element("button");
    			button.textContent = "Записаться";
    			attr(div0, "class", "background-image svelte-17s27fm");
    			add_location(div0, file, 63, 0, 1162);
    			attr(h20, "class", "svelte-17s27fm");
    			add_location(h20, file, 65, 2, 1388);
    			attr(h21, "class", "svelte-17s27fm");
    			add_location(h21, file, 66, 2, 1416);
    			attr(button, "class", "entry-sign-button svelte-17s27fm");
    			add_location(button, file, 67, 2, 1437);
    			attr(div1, "class", "entry svelte-17s27fm");
    			add_location(div1, file, 64, 0, 1282);
    			dispose = listen(button, "click", ctx.contact);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			append(div1, h20);
    			append(div1, t2);
    			append(div1, h21);
    			append(div1, t4);
    			append(div1, button);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div0_outro) div0_outro.end(1);
    				if (!div0_intro) div0_intro = create_in_transition(div0, fly, {x: 500, duration: 500, delay: 500});
    				div0_intro.start();
    			});

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);
    				if (!div1_intro) div1_intro = create_in_transition(div1, fly, {y: -400, duration: 500, delay: 500});
    				div1_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div0_intro) div0_intro.invalidate();

    			div0_outro = create_out_transition(div0, fly, {x: 500, duration: 500});

    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, fly, {y:-400, duration: 500});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    				if (div0_outro) div0_outro.end();
    				detach(t0);
    				detach(div1);
    				if (div1_outro) div1_outro.end();
    			}

    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	


      onMount(() => {
        setTimeout(() => {
          document.querySelector("body").classList.add("dark");
        }, 500);
      });

      onDestroy(() => {
        document.querySelector("body").classList.remove("dark");
      });

      let { contact } = $$props;

    	const writable_props = ['contact'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Entry> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('contact' in $$props) $$invalidate('contact', contact = $$props.contact);
    	};

    	return { contact };
    }

    class Entry extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["contact"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.contact === undefined && !('contact' in props)) {
    			console.warn("<Entry> was created without expected prop 'contact'");
    		}
    	}

    	get contact() {
    		throw new Error("<Entry>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contact(value) {
    		throw new Error("<Entry>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Scroller.svelte generated by Svelte v3.6.8 */

    const file$1 = "src/Scroller.svelte";

    function create_fragment$1(ctx) {
    	var div4, div0, t1, div2, div1, t2, div3, t3, t4;

    	return {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "01";
    			t1 = space();
    			div2 = element("div");
    			div1 = element("div");
    			t2 = space();
    			div3 = element("div");
    			t3 = text("0");
    			t4 = text(maxPage);
    			attr(div0, "class", "topCounter");
    			add_location(div0, file$1, 45, 2, 732);
    			attr(div1, "class", "scroller-indicator svelte-t4afbz");
    			set_style(div1, "height", "70px");
    			set_style(div1, "top", "" + ctx.indicatorSpacing + "px");
    			add_location(div1, file$1, 47, 4, 804);
    			attr(div2, "class", "scroller-container svelte-t4afbz");
    			add_location(div2, file$1, 46, 2, 767);
    			attr(div3, "class", "bottomCounter");
    			add_location(div3, file$1, 49, 2, 903);
    			attr(div4, "class", "scroller svelte-t4afbz");
    			add_location(div4, file$1, 44, 0, 707);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div4, anchor);
    			append(div4, div0);
    			append(div4, t1);
    			append(div4, div2);
    			append(div2, div1);
    			append(div4, t2);
    			append(div4, div3);
    			append(div3, t3);
    			append(div3, t4);
    		},

    		p: function update(changed, ctx) {
    			if (changed.indicatorSpacing) {
    				set_style(div1, "top", "" + ctx.indicatorSpacing + "px");
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div4);
    			}
    		}
    	};
    }

    let maxPage = 5;

    function instance$1($$self, $$props, $$invalidate) {
    	
    let { page } = $$props;

    	const writable_props = ['page'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Scroller> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('page' in $$props) $$invalidate('page', page = $$props.page);
    	};

    	let indicatorSpacing;

    	$$self.$$.update = ($$dirty = { page: 1 }) => {
    		if ($$dirty.page) { $$invalidate('indicatorSpacing', indicatorSpacing = 70 * (page - 1)); }
    	};

    	return { page, indicatorSpacing };
    }

    class Scroller extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["page"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.page === undefined && !('page' in props)) {
    			console.warn("<Scroller> was created without expected prop 'page'");
    		}
    	}

    	get page() {
    		throw new Error("<Scroller>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<Scroller>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Timetable.svelte generated by Svelte v3.6.8 */

    const file$2 = "src/Timetable.svelte";

    function create_fragment$2(ctx) {
    	var div, h2, div_intro, div_outro, current;

    	return {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Расписание";
    			attr(h2, "class", "svelte-9dutef");
    			add_location(h2, file$2, 29, 2, 558);
    			attr(div, "class", "timetable svelte-9dutef");
    			add_location(div, file$2, 28, 0, 448);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, {y: -300, duration: 500, delay: 500});
    				div_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, {y:-300, duration: 300});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    				if (div_outro) div_outro.end();
    			}
    		}
    	};
    }

    function instance$2($$self) {
    	

      onMount(() => {
        setTimeout(() => {
          document.querySelector("body").classList.add("light");
        }, 500);
      });

      onDestroy(() => {
        document.querySelector("body").classList.remove("light");
      });

    	return {};
    }

    class Timetable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
    	}
    }

    /* src/Team.svelte generated by Svelte v3.6.8 */

    const file$3 = "src/Team.svelte";

    function create_fragment$3(ctx) {
    	var div, h2, div_intro, div_outro, current;

    	return {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Команда";
    			attr(h2, "class", "svelte-1e1ghz6");
    			add_location(h2, file$3, 30, 2, 564);
    			attr(div, "class", "team svelte-1e1ghz6");
    			attr(div, "ы", "");
    			add_location(div, file$3, 29, 0, 458);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, {y: -300, duration: 500, delay: 500});
    				div_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, {y:-300, duration: 300});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    				if (div_outro) div_outro.end();
    			}
    		}
    	};
    }

    function instance$3($$self) {
    	

      onMount(() => {
        setTimeout(() => {
          document.querySelector("body").classList.add("dark");
        }, 500);
      });

      onDestroy(() => {
        document.querySelector("body").classList.remove("dark");
      });

    	return {};
    }

    class Team extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, []);
    	}
    }

    /* src/Galery.svelte generated by Svelte v3.6.8 */

    const file$4 = "src/Galery.svelte";

    function create_fragment$4(ctx) {
    	var div, h2, div_intro, div_outro, current;

    	return {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Галерея";
    			attr(h2, "class", "svelte-ve1vl7");
    			add_location(h2, file$4, 29, 2, 549);
    			attr(div, "class", "galery svelte-ve1vl7");
    			add_location(div, file$4, 28, 0, 442);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, {y: -300, duration: 500, delay: 500});
    				div_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, {y:-300, duration: 300});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    				if (div_outro) div_outro.end();
    			}
    		}
    	};
    }

    function instance$4($$self) {
    	

      onMount(() => {
        setTimeout(() => {
          document.querySelector("body").classList.add("light");
        }, 500);
      });

      onDestroy(() => {
        document.querySelector("body").classList.remove("light");
      });

    	return {};
    }

    class Galery extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, []);
    	}
    }

    /* src/Contacts.svelte generated by Svelte v3.6.8 */

    const file$5 = "src/Contacts.svelte";

    function create_fragment$5(ctx) {
    	var div, h2, div_intro, div_outro, current;

    	return {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Записаться";
    			attr(h2, "class", "svelte-b8haf2");
    			add_location(h2, file$5, 30, 2, 575);
    			attr(div, "class", "contacts svelte-b8haf2");
    			add_location(div, file$5, 29, 0, 466);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, {y: -300, duration: 500, delay: 500});
    				div_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, {y:-300, duration: 300});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    				if (div_outro) div_outro.end();
    			}
    		}
    	};
    }

    function instance$5($$self) {
    	

      onMount(() => {
        setTimeout(() => {
          document.querySelector("body").classList.add("dark");
        }, 500);
      });

      onDestroy(() => {
        document.querySelector("body").classList.remove("dark");
      });

    	return {};
    }

    class Contacts extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
    	}
    }

    /* src/App.svelte generated by Svelte v3.6.8 */

    const file$6 = "src/App.svelte";

    // (140:0) {#if page === 1}
    function create_if_block_4(ctx) {
    	var current;

    	var entry = new Entry({
    		props: { contact: ctx.func },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			entry.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(entry, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var entry_changes = {};
    			if (changed.page) entry_changes.contact = ctx.func;
    			entry.$set(entry_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(entry.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(entry.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(entry, detaching);
    		}
    	};
    }

    // (143:0) {#if page === 2}
    function create_if_block_3(ctx) {
    	var current;

    	var timetable = new Timetable({ $$inline: true });

    	return {
    		c: function create() {
    			timetable.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(timetable, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(timetable.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(timetable.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(timetable, detaching);
    		}
    	};
    }

    // (146:0) {#if page === 3}
    function create_if_block_2(ctx) {
    	var current;

    	var team = new Team({ $$inline: true });

    	return {
    		c: function create() {
    			team.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(team, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(team.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(team.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(team, detaching);
    		}
    	};
    }

    // (149:0) {#if page === 4}
    function create_if_block_1(ctx) {
    	var current;

    	var galery = new Galery({ $$inline: true });

    	return {
    		c: function create() {
    			galery.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(galery, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(galery.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(galery.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(galery, detaching);
    		}
    	};
    }

    // (152:0) {#if page === 5}
    function create_if_block(ctx) {
    	var current;

    	var contacts = new Contacts({ $$inline: true });

    	return {
    		c: function create() {
    			contacts.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(contacts, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(contacts.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(contacts.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(contacts, detaching);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	var header, div0, t1, ul, li0, a0, t3, li1, a1, t5, li2, a2, t7, li3, a3, t9, li4, a4, t11, aside, updating_page, t12, main, t13, t14, t15, t16, t17, div1, span0, t18, t19, t20, span1, current, dispose;

    	function scroller_page_binding(value) {
    		ctx.scroller_page_binding.call(null, value);
    		updating_page = true;
    		add_flush_callback(() => updating_page = false);
    	}

    	let scroller_props = {};
    	if (ctx.page !== void 0) {
    		scroller_props.page = ctx.page;
    	}
    	var scroller = new Scroller({ props: scroller_props, $$inline: true });

    	binding_callbacks.push(() => bind(scroller, 'page', scroller_page_binding));

    	var if_block0 = (ctx.page === 1) && create_if_block_4(ctx);

    	var if_block1 = (ctx.page === 2) && create_if_block_3();

    	var if_block2 = (ctx.page === 3) && create_if_block_2();

    	var if_block3 = (ctx.page === 4) && create_if_block_1();

    	var if_block4 = (ctx.page === 5) && create_if_block();

    	return {
    		c: function create() {
    			header = element("header");
    			div0 = element("div");
    			div0.textContent = "ХК Медведь";
    			t1 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Главная";
    			t3 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Расписание";
    			t5 = space();
    			li2 = element("li");
    			a2 = element("a");
    			a2.textContent = "Команда";
    			t7 = space();
    			li3 = element("li");
    			a3 = element("a");
    			a3.textContent = "Галерея";
    			t9 = space();
    			li4 = element("li");
    			a4 = element("a");
    			a4.textContent = "Записаться";
    			t11 = space();
    			aside = element("aside");
    			scroller.$$.fragment.c();
    			t12 = space();
    			main = element("main");
    			if (if_block0) if_block0.c();
    			t13 = space();
    			if (if_block1) if_block1.c();
    			t14 = space();
    			if (if_block2) if_block2.c();
    			t15 = space();
    			if (if_block3) if_block3.c();
    			t16 = space();
    			if (if_block4) if_block4.c();
    			t17 = space();
    			div1 = element("div");
    			span0 = element("span");
    			t18 = text("0");
    			t19 = text(ctx.page);
    			t20 = space();
    			span1 = element("span");
    			attr(div0, "class", "header-naming svelte-14ju0bk");
    			add_location(div0, file$6, 113, 2, 2318);
    			attr(a0, "href", "#nogo");
    			attr(a0, "class", "svelte-14ju0bk");
    			add_location(a0, file$6, 116, 6, 2441);
    			attr(li0, "class", "header-navigation-item svelte-14ju0bk");
    			add_location(li0, file$6, 115, 4, 2399);
    			attr(a1, "href", "#nogo");
    			attr(a1, "class", "svelte-14ju0bk");
    			add_location(a1, file$6, 119, 6, 2551);
    			attr(li1, "class", "header-navigation-item svelte-14ju0bk");
    			add_location(li1, file$6, 118, 4, 2509);
    			attr(a2, "href", "#nogo");
    			attr(a2, "class", "svelte-14ju0bk");
    			add_location(a2, file$6, 122, 6, 2664);
    			attr(li2, "class", "header-navigation-item svelte-14ju0bk");
    			add_location(li2, file$6, 121, 4, 2622);
    			attr(a3, "href", "#nogo");
    			attr(a3, "class", "svelte-14ju0bk");
    			add_location(a3, file$6, 125, 6, 2774);
    			attr(li3, "class", "header-navigation-item svelte-14ju0bk");
    			add_location(li3, file$6, 124, 4, 2732);
    			attr(a4, "href", "#nogo");
    			attr(a4, "class", "svelte-14ju0bk");
    			add_location(a4, file$6, 131, 6, 3003);
    			attr(li4, "class", "header-navigation-item svelte-14ju0bk");
    			add_location(li4, file$6, 130, 4, 2961);
    			attr(ul, "class", "header-navigation svelte-14ju0bk");
    			add_location(ul, file$6, 114, 2, 2364);
    			attr(header, "class", "svelte-14ju0bk");
    			add_location(header, file$6, 112, 0, 2307);
    			attr(aside, "class", "svelte-14ju0bk");
    			add_location(aside, file$6, 135, 0, 3088);
    			attr(main, "class", "svelte-14ju0bk");
    			add_location(main, file$6, 138, 0, 3129);
    			attr(span0, "class", "pageStatus-text svelte-14ju0bk");
    			add_location(span0, file$6, 156, 2, 3375);
    			attr(span1, "class", "arrow-down svelte-14ju0bk");
    			add_location(span1, file$6, 157, 2, 3422);
    			attr(div1, "class", "pageStatus svelte-14ju0bk");
    			add_location(div1, file$6, 155, 0, 3348);

    			dispose = [
    				listen(a0, "click", ctx.click_handler),
    				listen(a1, "click", ctx.click_handler_1),
    				listen(a2, "click", ctx.click_handler_2),
    				listen(a3, "click", ctx.click_handler_3),
    				listen(a4, "click", ctx.click_handler_4)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, header, anchor);
    			append(header, div0);
    			append(header, t1);
    			append(header, ul);
    			append(ul, li0);
    			append(li0, a0);
    			append(ul, t3);
    			append(ul, li1);
    			append(li1, a1);
    			append(ul, t5);
    			append(ul, li2);
    			append(li2, a2);
    			append(ul, t7);
    			append(ul, li3);
    			append(li3, a3);
    			append(ul, t9);
    			append(ul, li4);
    			append(li4, a4);
    			insert(target, t11, anchor);
    			insert(target, aside, anchor);
    			mount_component(scroller, aside, null);
    			insert(target, t12, anchor);
    			insert(target, main, anchor);
    			if (if_block0) if_block0.m(main, null);
    			append(main, t13);
    			if (if_block1) if_block1.m(main, null);
    			append(main, t14);
    			if (if_block2) if_block2.m(main, null);
    			append(main, t15);
    			if (if_block3) if_block3.m(main, null);
    			append(main, t16);
    			if (if_block4) if_block4.m(main, null);
    			insert(target, t17, anchor);
    			insert(target, div1, anchor);
    			append(div1, span0);
    			append(span0, t18);
    			append(span0, t19);
    			append(div1, t20);
    			append(div1, span1);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var scroller_changes = {};
    			if (!updating_page && changed.page) {
    				scroller_changes.page = ctx.page;
    			}
    			scroller.$set(scroller_changes);

    			if (ctx.page === 1) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t13);
    				}
    			} else if (if_block0) {
    				group_outros();
    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});
    				check_outros();
    			}

    			if (ctx.page === 2) {
    				if (!if_block1) {
    					if_block1 = create_if_block_3();
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t14);
    				} else {
    									transition_in(if_block1, 1);
    				}
    			} else if (if_block1) {
    				group_outros();
    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});
    				check_outros();
    			}

    			if (ctx.page === 3) {
    				if (!if_block2) {
    					if_block2 = create_if_block_2();
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(main, t15);
    				} else {
    									transition_in(if_block2, 1);
    				}
    			} else if (if_block2) {
    				group_outros();
    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});
    				check_outros();
    			}

    			if (ctx.page === 4) {
    				if (!if_block3) {
    					if_block3 = create_if_block_1();
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(main, t16);
    				} else {
    									transition_in(if_block3, 1);
    				}
    			} else if (if_block3) {
    				group_outros();
    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});
    				check_outros();
    			}

    			if (ctx.page === 5) {
    				if (!if_block4) {
    					if_block4 = create_if_block();
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(main, null);
    				} else {
    									transition_in(if_block4, 1);
    				}
    			} else if (if_block4) {
    				group_outros();
    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});
    				check_outros();
    			}

    			if (!current || changed.page) {
    				set_data(t19, ctx.page);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(scroller.$$.fragment, local);

    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(scroller.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(header);
    				detach(t11);
    				detach(aside);
    			}

    			destroy_component(scroller);

    			if (detaching) {
    				detach(t12);
    				detach(main);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();

    			if (detaching) {
    				detach(t17);
    				detach(div1);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	


      onMount(() => {
          document.querySelector("body").classList.add("dark");
      });

      let page = 1;

    	function click_handler() {
    		const $$result = page = 1;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	function click_handler_1() {
    		const $$result = page = 2;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	function click_handler_2() {
    		const $$result = page = 3;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	function click_handler_3() {
    		const $$result = page = 4;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	function click_handler_4() {
    		const $$result = page = 5;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	function scroller_page_binding(value) {
    		page = value;
    		$$invalidate('page', page);
    	}

    	function func() {
    		const $$result = page = 5;
    		$$invalidate('page', page);
    		return $$result;
    	}

    	return {
    		page,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		scroller_page_binding,
    		func
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
