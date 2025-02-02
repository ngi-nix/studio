import css from "css";

export function closest(element: any, predicate: (element: any) => boolean) {
    while (element) {
        if (predicate(element)) {
            return element;
        }
        element = element.parentNode;
    }
}

export function closestByClass(element: any, className: string) {
    return closest(element, (element: any) => {
        const elementClassName =
            element.getAttribute && element.getAttribute("class");
        if (!elementClassName) {
            return false;
        }
        return elementClassName.indexOf(className) !== -1;
    });
}

export function closestBySelector(element: any, selector: string) {
    return closest(element, (element: any) => {
        return element.matches && element.matches(selector);
    });
}

export function hasClass(element: any, className: string) {
    return (
        element &&
        element.className &&
        element.className.match(new RegExp("\\b" + className + "\\b"))
    );
}

export function addScript(src: string) {
    return new Promise(resolve => {
        let script = document.createElement("script");
        script.type = "text/javascript";
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
    });
}

export function addCssStylesheet(id: string, href: string) {
    if (!document.getElementById(id) && document.head) {
        let link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = href;
        document.head.appendChild(link);
    }
}

export function scrollIntoViewIfNeeded(el: HTMLElement) {
    if ((el as any).scrollIntoViewIfNeeded) {
        (el as any).scrollIntoViewIfNeeded();
    } else {
        el.scrollIntoView();
    }
}

// this is used to scope css to the given element
export function attachCssToElement(el: HTMLDivElement, cssStr: string) {
    if (!cssStr) {
        return undefined;
    }

    // generate random class name, eight 'a' - 'z' characters
    function generateRandomClassName() {
        let className = "";
        for (let i = 0; i < 8; i++) {
            className += String.fromCodePoint(
                "a".charCodeAt(0) + Math.round(Math.random() * 25)
            );
        }
        return className;
    }
    const className = generateRandomClassName();

    // add class name to the element
    el.classList.add(className);

    // prefix each CSS selector in given css string (cssStr) with the generated class name
    const ast = css.parse(cssStr);

    if (ast.stylesheet) {
        for (const stylesheetRule of ast.stylesheet.rules) {
            if (stylesheetRule.type == "rule") {
                const rule = stylesheetRule as css.Rule;
                if (rule.selectors) {
                    rule.selectors = rule.selectors.map(
                        selector => `.${className} ${selector}`
                    );
                }
            }
        }
    }

    const prefixedCssStr = css.stringify(ast);

    // create style element
    const style = document.createElement("style");
    style.appendChild(document.createTextNode(prefixedCssStr));
    document.head.appendChild(style);

    return () => {
        // dispose
        style.remove();
    };
}
