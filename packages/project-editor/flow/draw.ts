import tinycolor from "tinycolor2";

import {
    blendColor,
    getColorRGB,
    to16bitsColor
} from "eez-studio-shared/color";

import { Style } from "project-editor/features/style/style";
import { Font, getPixelByteIndex } from "project-editor/features/font/font";

////////////////////////////////////////////////////////////////////////////////

let fgColor: string;
let bgColor: string;

export function getColor() {
    return fgColor;
}

export function setColor(color: string) {
    fgColor = to16bitsColor(color);
}

export function getBackColor() {
    return bgColor;
}

export function setBackColor(color: string) {
    bgColor = to16bitsColor(color);
}

export function drawRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.beginPath();
    ctx.rect(x1 + 0.5, y1 + 0.5, x2 - x1 + 1, y2 - y1 + 1);
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number = 0
) {
    if (r == 0) {
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
        ctx.fillStyle = fgColor;
        ctx.fill();
    } else {
        // draw rounded rect
        fillRect(ctx, x1 + r, y1, x2 - r, y1 + r - 1);
        fillRect(ctx, x1, y1 + r, x1 + r - 1, y2 - r);
        fillRect(ctx, x2 + 1 - r, y1 + r, x2, y2 - r);
        fillRect(ctx, x1 + r, y2 - r + 1, x2 - r, y2);
        fillRect(ctx, x1 + r, y1 + r, x2 - r, y2 - r);

        for (let ry = 0; ry <= r; ry++) {
            let rx = Math.round(Math.sqrt(r * r - ry * ry));
            drawHLine(ctx, x2 - r, y2 - r + ry, rx);
            drawHLine(ctx, x1 + r - rx, y2 - r + ry, rx);
            drawHLine(ctx, x2 - r, y1 + r - ry, rx);
            drawHLine(ctx, x1 + r - rx, y1 + r - ry, rx);
        }
    }
}

export function drawHLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    l: number
) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + 0.5 + l, y + 0.5);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

export function drawVLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    l: number
) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + 0.5, y + l + 0.5);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

function getGlyph(font: Font, encoding: number) {
    return font && font.glyphsMap.get(encoding);
}

function measureGlyph(encoding: number, font: Font): number {
    let glyph = getGlyph(font, encoding);
    if (!glyph) {
        return 0;
    }

    return glyph.dx || 0;
}

export function measureStr(text: string, font: Font, maxWidth: number): number {
    let width = 0;

    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);
        let glyph_width = measureGlyph(encoding, font);
        if (maxWidth > 0 && width + glyph_width > maxWidth) {
            return maxWidth;
        }
        width += glyph_width;
    }

    return width;
}

let MAX_GLYPH_WIDTH = 256;
let MAX_GLYPH_HEIGHT = 256;
let pixelImageData: ImageData;
let pixelData: Uint8ClampedArray;

export function drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    encoding: number,
    font: Font
): number {
    if (!pixelImageData) {
        pixelImageData = ctx.createImageData(MAX_GLYPH_WIDTH, MAX_GLYPH_HEIGHT);
        pixelData = pixelImageData.data;
        pixelData.fill(255);
    }

    let glyph = getGlyph(font, encoding);
    if (!glyph || !glyph.glyphBitmap) {
        return 0;
    }

    let x_glyph = x + glyph.x;
    let y_glyph = y + font.ascent - (glyph.y + glyph.height);

    let width = glyph.width;
    let height = glyph.height;

    if (width > 0 && height > 0) {
        let i = 0;
        const offset = (MAX_GLYPH_WIDTH - width) * 4;
        const fgColorRgb = tinycolor(fgColor).toRgb();
        const bgColorRgb = tinycolor(bgColor).toRgb();
        const pixelArray = glyph.glyphBitmap.pixelArray;
        if (pixelArray) {
            if (font.bpp === 8) {
                let pixelArrayIndex = 0;
                const pixelArrayOffset = glyph.glyphBitmap.width - width;
                const mixedColor = { r: 0, g: 0, b: 0 };
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const color = blendColor(
                            fgColorRgb,
                            bgColorRgb,
                            pixelArray[pixelArrayIndex++] / 255,
                            mixedColor
                        );
                        pixelData[i++] = color.r;
                        pixelData[i++] = color.g;
                        pixelData[i++] = color.b;
                        i++;
                    }
                    i += offset;
                    pixelArrayIndex += pixelArrayOffset;
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel =
                            pixelArray[
                                getPixelByteIndex(glyph.glyphBitmap, x, y)
                            ] &
                            (0x80 >> x % 8);
                        if (pixel) {
                            pixelData[i++] = fgColorRgb.r;
                            pixelData[i++] = fgColorRgb.g;
                            pixelData[i++] = fgColorRgb.b;
                        } else {
                            pixelData[i++] = bgColorRgb.r;
                            pixelData[i++] = bgColorRgb.g;
                            pixelData[i++] = bgColorRgb.b;
                        }
                        i++;
                    }
                    i += offset;
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    pixelData[i++] = bgColorRgb.r;
                    pixelData[i++] = bgColorRgb.g;
                    pixelData[i++] = bgColorRgb.b;
                    i++;
                }
                i += offset;
            }
        }
        ctx.putImageData(pixelImageData, x_glyph, y_glyph, 0, 0, width, height);
    }

    return glyph.dx || 0;
}

export function drawStr(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    font: Font
) {
    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);
        x += drawGlyph(ctx, x, y, encoding, font);
    }
}

export function drawBitmap(
    ctx: CanvasRenderingContext2D,
    bitmap: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    ctx.drawImage(bitmap, x + 0.5, y + 0.5, width, height);
}

////////////////////////////////////////////////////////////////////////////////

export function styleGetBorderRadius(style: Style) {
    return style.borderRadiusProperty;
}

export function styleIsHorzAlignLeft(style: Style) {
    return style.alignHorizontalProperty == "left";
}

export function styleIsHorzAlignRight(style: Style) {
    return style.alignHorizontalProperty == "right";
}

export function styleIsVertAlignTop(style: Style) {
    return style.alignVerticalProperty == "top";
}

export function styleIsVertAlignBottom(style: Style) {
    return style.alignVerticalProperty == "bottom";
}

export function styleGetFont(style: Style) {
    return style.fontObject;
}

////////////////////////////////////////////////////////////////////////////////

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    style: Style,
    inverse: boolean,
    overrideBackgroundColor?: string
) {
    let x1 = x;
    let y1 = y;
    let x2 = x + w - 1;
    let y2 = y + h - 1;

    const borderSize = style.borderSizeRect;
    let borderRadius = styleGetBorderRadius(style) || 0;
    if (
        borderSize.top > 0 ||
        borderSize.right > 0 ||
        borderSize.bottom > 0 ||
        borderSize.left > 0
    ) {
        setColor(style.borderColorProperty);
        fillRect(ctx, x1, y1, x2, y2, borderRadius);
        x1 += borderSize.left;
        y1 += borderSize.top;
        x2 -= borderSize.right;
        y2 -= borderSize.bottom;
        borderRadius = Math.max(
            borderRadius -
                Math.max(
                    borderSize.top,
                    borderSize.right,
                    borderSize.bottom,
                    borderSize.left
                ),
            0
        );
    }

    const styleColor = style.colorProperty;
    const styleBackgroundColor =
        overrideBackgroundColor !== undefined
            ? overrideBackgroundColor
            : style.backgroundColorProperty;

    let backgroundColor = inverse ? styleColor : styleBackgroundColor;
    setColor(backgroundColor);
    fillRect(ctx, x1, y1, x2, y2, borderRadius);

    const font = styleGetFont(style);
    if (!font) {
        return;
    }

    try {
        text = JSON.parse('"' + text + '"');
    } catch (e) {
        console.log(e, text);
    }

    let width = measureStr(text, font, 0);
    let height = font.height;

    if (width > 0 && height > 0) {
        let x_offset: number;
        if (styleIsHorzAlignLeft(style)) {
            x_offset = x1 + style.paddingRect.left;
        } else if (styleIsHorzAlignRight(style)) {
            x_offset = x2 - style.paddingRect.right - width;
        } else {
            x_offset = Math.floor(x1 + (x2 - x1 + 1 - width) / 2);
            if (x_offset < x1) {
                x_offset = x1;
            }
        }

        let y_offset: number;
        if (styleIsVertAlignTop(style)) {
            y_offset = y1 + style.paddingRect.top;
        } else if (styleIsVertAlignBottom(style)) {
            y_offset = y2 - style.paddingRect.bottom - height;
        } else {
            y_offset = Math.floor(y1 + (y2 - y1 + 1 - height) / 2);
        }

        if (inverse) {
            setBackColor(styleColor);
            setColor(styleBackgroundColor);
        } else {
            setBackColor(styleBackgroundColor);
            setColor(styleColor);
        }
        drawStr(ctx, text, x_offset, y_offset, width, height, font);
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ImageBuffer {
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
}

export function pixelRGBA(
    imageBuffer: ImageBuffer,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x = Math.floor(x);
    y = Math.floor(y);

    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 0] = r;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 1] = g;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 2] = b;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 3] = a;
}

export function pixelRGBAWeight(
    imageBuffer: ImageBuffer,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
    weight: number
) {
    /*
     * Modify Alpha by weight
     */
    let ax = a;
    ax = (ax * weight) >> 8;
    if (ax > 255) {
        a = 255;
    } else {
        a = ax & 0x000000ff;
    }

    pixelRGBA(imageBuffer, x, y, r, g, b, a);
}

export function vlineRGBA(
    imageBuffer: ImageBuffer,
    x: number,
    y1: number,
    y2: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x = Math.floor(x);
    y1 = Math.floor(y1);
    y2 = Math.floor(y2);

    if (y1 > y2) {
        const temp = y1;
        y1 = y2;
        y2 = temp;
    }

    for (let y = y1; y <= y2; y++) {
        pixelRGBA(imageBuffer, x, y, r, g, b, a);
    }
}

export function hlineRGBA(
    imageBuffer: ImageBuffer,
    x1: number,
    x2: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x1 = Math.floor(x1);
    x2 = Math.floor(x2);
    y = Math.floor(y);

    if (x1 > x2) {
        const temp = x1;
        x1 = x2;
        x2 = temp;
    }

    for (let x = x1; x <= x2; x++) {
        pixelRGBA(imageBuffer, x, y, r, g, b, a);
    }
}

export function aalineRGBA(
    imageBuffer: ImageBuffer,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
    g: number,
    b: number,
    a: number,
    draw_endpoint: number
) {
    let xx0: number, yy0: number, xx1: number, yy1: number;
    let erracc: number, erradj: number;
    let wgt: number;
    let dx: number,
        dy: number,
        tmp: number,
        xdir: number,
        y0p1: number,
        x0pxdir: number;

    /*
     * Keep on working with 32bit numbers
     */
    xx0 = x1;
    yy0 = y1;
    xx1 = x2;
    yy1 = y2;

    /*
     * Reorder points to make dy positive
     */
    if (yy0 > yy1) {
        tmp = yy0;
        yy0 = yy1;
        yy1 = tmp;
        tmp = xx0;
        xx0 = xx1;
        xx1 = tmp;
    }

    /*
     * Calculate distance
     */
    dx = xx1 - xx0;
    dy = yy1 - yy0;

    /*
     * Adjust for negative dx and set xdir
     */
    if (dx >= 0) {
        xdir = 1;
    } else {
        xdir = -1;
        dx = -dx;
    }

    /*
     * Check for special cases
     */
    if (dx == 0) {
        /*
         * Vertical line
         */
        if (draw_endpoint) {
            vlineRGBA(imageBuffer, x1, y1, y2, r, g, b, a);
        } else {
            if (dy > 0) {
                vlineRGBA(imageBuffer, x1, yy0, yy0 + dy, r, g, b, a);
            } else {
                pixelRGBA(imageBuffer, x1, y1, r, g, b, a);
            }
        }
        return;
    } else if (dy == 0) {
        /*
         * Horizontal line
         */
        if (draw_endpoint) {
            hlineRGBA(imageBuffer, x1, x2, y1, r, g, b, a);
        } else {
            if (dx > 0) {
                hlineRGBA(imageBuffer, xx0, xx0 + xdir * dx, y1, r, g, b, a);
            } else {
                pixelRGBA(imageBuffer, x1, y1, r, g, b, a);
            }
        }
        return;
    }
    // else if (dx == dy && draw_endpoint) {
    //     /*
    //      * Diagonal line (with endpoint)
    //      */
    //     lineRGBA(imageBuffer, x1, y1, x2, y2, r, g, b, a);
    //     return;
    // }

    /*
     * Zero accumulator
     */
    erracc = 0;

    /*
     * Draw the initial pixel in the foreground color
     */
    pixelRGBA(imageBuffer, x1, y1, r, g, b, a);

    /*
     * x-major or y-major?
     */
    if (dy > dx) {
        /*
         * y-major.  Calculate 16-bit fixed point fractional part of a pixel that
         * X advances every time Y advances 1 pixel, truncating the result so that
         * we won't overrun the endpoint along the X axis
         */
        /*
         * Not-so-portable version: erradj = ((Uint64)dx << 32) / (Uint64)dy;
         */
        erradj = dx / dy;

        /*
         * draw all pixels other than the first and last
         */
        x0pxdir = xx0 + xdir;
        while (--dy) {
            erracc += erradj;
            if (erracc >= 1.0) {
                erracc -= 1.0;
                /*
                 * rollover in error accumulator, x coord advances
                 */
                xx0 = x0pxdir;
                x0pxdir += xdir;
            }
            yy0++; /* y-major so always advance Y */

            /*
             * the AAbits most significant bits of erracc give us the intensity
             * weighting for this pixel, and the complement of the weighting for
             * the paired pixel.
             */
            wgt = Math.floor(erracc * 255);
            pixelRGBAWeight(
                imageBuffer,
                xx0,
                yy0,
                r,
                g,
                b,
                a,
                Number(255 - wgt)
            );
            pixelRGBAWeight(imageBuffer, x0pxdir, yy0, r, g, b, a, Number(wgt));
        }
    } else {
        /*
         * x-major line.  Calculate 16-bit fixed-point fractional part of a pixel
         * that Y advances each time X advances 1 pixel, truncating the result so
         * that we won't overrun the endpoint along the X axis.
         */
        /*
         * Not-so-portable version: erradj = ((Uint64)dy << 32) / (Uint64)dx;
         */
        erradj = dy / dx;

        /*
         * draw all pixels other than the first and last
         */
        y0p1 = yy0 + 1;
        while (--dx) {
            erracc += erradj;
            if (erracc >= 1.0) {
                erracc -= 1.0;
                /*
                 * Accumulator turned over, advance y
                 */
                yy0 = y0p1;
                y0p1++;
            }
            xx0 += xdir; /* x-major so always advance X */
            /*
             * the AAbits most significant bits of erracc give us the intensity
             * weighting for this pixel, and the complement of the weighting for
             * the paired pixel.
             */
            wgt = Math.floor(erracc * 255);
            pixelRGBAWeight(
                imageBuffer,
                xx0,
                yy0,
                r,
                g,
                b,
                a,
                Number(255 - wgt)
            );
            pixelRGBAWeight(imageBuffer, xx0, y0p1, r, g, b, a, Number(wgt));
        }
    }

    /*
     * Do we have to draw the endpoint
     */
    if (draw_endpoint) {
        /*
         * Draw final pixel, always exactly intersected by the line and doesn't
         * need to be weighted.
         */
        pixelRGBA(imageBuffer, x2, y2, r, g, b, a);
    }
}

export function aapolygonRGBA(
    imageBuffer: ImageBuffer,
    vx: number[],
    vy: number[],
    n: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    for (let i = 1; i < n; i++) {
        aalineRGBA(
            imageBuffer,
            vx[i - 1],
            vy[i - 1],
            vx[i],
            vy[i],
            r,
            g,
            b,
            a,
            0
        );
    }

    aalineRGBA(imageBuffer, vx[n - 1], vy[n - 1], vx[0], vy[0], r, g, b, a, 0);
}

export function filledPolygonRGBA(
    imageBuffer: ImageBuffer,
    vx: number[],
    vy: number[],
    n: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    let i: number;
    let y: number, xa: number, xb: number;
    let miny: number, maxy: number;
    let x1: number, y1: number;
    let x2: number, y2: number;
    let ind1: number, ind2: number;
    let ints: number;
    let gfxPrimitivesPolyInts: number[] = [];

    /*
     * Sanity check number of edges
     */
    if (n < 3) {
        return;
    }

    /*
     * Determine Y maxima
     */
    miny = vy[0];
    maxy = vy[0];
    for (i = 1; i < n; i++) {
        if (vy[i] < miny) {
            miny = vy[i];
        } else if (vy[i] > maxy) {
            maxy = vy[i];
        }
    }

    /*
     * Draw, scanning y
     */
    for (y = miny; y <= maxy; y++) {
        ints = 0;
        for (i = 0; i < n; i++) {
            if (!i) {
                ind1 = n - 1;
                ind2 = 0;
            } else {
                ind1 = i - 1;
                ind2 = i;
            }
            y1 = vy[ind1];
            y2 = vy[ind2];
            if (y1 < y2) {
                x1 = vx[ind1];
                x2 = vx[ind2];
            } else if (y1 > y2) {
                y2 = vy[ind1];
                y1 = vy[ind2];
                x2 = vx[ind1];
                x1 = vx[ind2];
            } else {
                continue;
            }
            if ((y >= y1 && y < y2) || (y == maxy && y > y1 && y <= y2)) {
                gfxPrimitivesPolyInts[ints++] = Math.round(
                    x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)
                );
            }
        }

        gfxPrimitivesPolyInts.sort();

        for (i = 0; i < ints; i += 2) {
            xa = gfxPrimitivesPolyInts[i] + 1;
            xb = gfxPrimitivesPolyInts[i + 1] - 1;
            hlineRGBA(imageBuffer, xa, xb, y, r, g, b, a);
        }

        gfxPrimitivesPolyInts = [];
    }
}

function arcBarAsPolygon(
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number,
    vx: number[],
    vy: number[],
    n: number
) {
    const fromAngle = (fromAngleDeg * Math.PI) / 180;
    const toAngle = (toAngleDeg * Math.PI) / 180;

    let j = 0;

    vx[j] = Math.round(xCenter + (radius + width / 2.0) * Math.cos(fromAngle));
    vy[j] = Math.round(yCenter - (radius + width / 2.0) * Math.sin(fromAngle));
    j++;

    for (let i = 0; ; i++) {
        const angle = (i * 2 * Math.PI) / n;
        if (angle >= toAngle) {
            break;
        }
        if (angle > fromAngle) {
            vx[j] = Math.round(
                xCenter + (radius + width / 2.0) * Math.cos(angle)
            );
            vy[j] = Math.round(
                yCenter - (radius + width / 2.0) * Math.sin(angle)
            );
            j++;
        }
    }

    vx[j] = Math.round(xCenter + (radius + width / 2.0) * Math.cos(toAngle));
    vy[j] = Math.round(yCenter - (radius + width / 2.0) * Math.sin(toAngle));
    j++;

    vx[j] = Math.round(xCenter + (radius - width / 2.0) * Math.cos(toAngle));
    vy[j] = Math.round(yCenter - (radius - width / 2.0) * Math.sin(toAngle));
    j++;

    for (let i = 0; ; i++) {
        const angle = 2 * Math.PI - (i * 2 * Math.PI) / n;
        if (angle <= fromAngle) {
            break;
        }

        if (angle < toAngle) {
            vx[j] = Math.round(
                xCenter + (radius - width / 2.0) * Math.cos(angle)
            );
            vy[j] = Math.round(
                yCenter - (radius - width / 2.0) * Math.sin(angle)
            );
            j++;
        }
    }

    vx[j] = Math.round(xCenter + (radius - width / 2.0) * Math.cos(fromAngle));
    vy[j] = Math.round(yCenter - (radius - width / 2.0) * Math.sin(fromAngle));
    j++;

    n = j;

    return { n };
}

export function drawArcBar(
    imageBuffer: ImageBuffer,
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number
) {
    const N = 50;
    const vx: number[] = [];
    const vy: number[] = [];
    const { n } = arcBarAsPolygon(
        xCenter,
        yCenter,
        radius,
        fromAngleDeg,
        toAngleDeg,
        width,
        vx,
        vy,
        N
    );

    let { r, g, b, a } = getColorRGB(fgColor);
    a = Math.floor(a * 255);

    aapolygonRGBA(imageBuffer, vx, vy, n, r, g, b, a);
}

export function fillArcBar(
    imageBuffer: ImageBuffer,
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number
) {
    const N = 50;
    const vx: number[] = [];
    const vy: number[] = [];
    const { n } = arcBarAsPolygon(
        xCenter,
        yCenter,
        radius,
        fromAngleDeg,
        toAngleDeg,
        width,
        vx,
        vy,
        N
    );

    let { r, g, b, a } = getColorRGB(fgColor);
    a = Math.floor(a * 255);

    filledPolygonRGBA(imageBuffer, vx, vy, n, r, g, b, a);
}
