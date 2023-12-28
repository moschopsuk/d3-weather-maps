import './App.scss';
import React, { useEffect, useRef } from "react";

import * as d3 from 'd3';
import countyData from "./data/eur.json";
import frontsData from "./data/fronts.json";


function App() {
    const ref = useRef(null)

    const parseFront = function (front_type: string) : (string | void) {
        switch (front_type) {
            case "Trough":
                return "trough";
            case "Warm Front":
                return "warm-front";
            case "Cold Front":
            case "Forming Cold Front":
                return "cold-front";
            case "Occluded Front":
            case "Dissipating Occluded Front":
                return "occluded-front";
            case "Stationary Front":
                return "stationary-front";
        }
    };

    function drawCircle(start: SVGPoint, end: SVGPoint, context: d3.Path, size: number, a: boolean) {
        const o = start.x - end.x,
            r = start.y - end.y,
            s = Math.atan2(-o, r),
            c = end.x + o / 2,
            l = end.y + r / 2,
            d = a ? s + Math.PI / 2 : s - Math.PI / 2,
            p = a ? s - Math.PI / 2 : s + Math.PI / 2;
        context.moveTo(c, l), context.arc(c, l, size, d, p);
    }

    function drawTriangle(start: SVGPoint, end: SVGPoint, context: d3.Path, size: number) {
        const a = start.x - end.x,
            o = start.y - end.y,
            r = Math.atan2(-a, o);
        context.moveTo(start.x, start.y), context.lineTo(end.x, end.y);
        const s = end.y + o / 2,
            c = end.x + a / 2 + Math.cos(r) * size,
            l = s + Math.sin(r) * size;
        context.lineTo(c, l), context.lineTo(start.x, start.y);
    }

    const renderFronts = function(g: d3.Selection<SVGGElement, unknown, null, undefined>) :void {
        Array.from(g.selectAll("path")).forEach((e: any) => {

            const context = d3.path(); 
            const front_type = e.getAttribute("class");
            const total_length  = e.getTotalLength();
            const dist = total_length / 14;
            let last_shape = "circle";

            for (let r = 1; r <= dist; r++) {
                const start: SVGPoint = e.getPointAtLength((r / dist) * total_length);
                const end: SVGPoint  = e.getPointAtLength(((r - 1) / dist) * total_length);

                if (!(Math.abs(start.x - end.x) > 20 || Math.abs(start.y - end.y) > 20)) {
                    switch (front_type) {
                        case "warm-front":
                            drawCircle(start, end, context, 6, false)
                            break;
    
                        case "cold-front":
                            drawTriangle(start, end, context, 6)
                            break;

                        case "occluded-front":
                            if (last_shape == "circle") {
                                drawCircle(start, end, context, 6, false);
                                last_shape = "triangle";
                            } else {
                                drawTriangle(start, end, context, 6);
                                last_shape = "circle";
                            }
                            break;

                        case "stationary-front":
                            if (last_shape == "circle") {
                                drawCircle(start, end, context, 6, true);
                                last_shape = "triangle";
                            } else {
                                drawTriangle(start, end, context, 6);
                                last_shape = "circle";
                            }
                            break;
                    }                    
                }
            }

            g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", context as any)
            .attr("class", `${front_type} shape`);
        });
    }

    useEffect(() => {
        let height = 600;
        let width = 800;

        const svg = d3.select(ref.current)
            .attr('class', 'center-container')
            .attr('height', height)
            .attr('width', width);

        // Remove any previous layers or else react will overwrite on HWR
        svg.selectAll("*").remove();

        svg.append('rect')
            .attr('class', 'background center-container')
            .attr('height', height)
            .attr('width', width)

        const projection = d3.geoMercator()
            .scale(4460/Math.PI/2)
            .translate([480,980])
      
        const pathGenerator = d3.geoPath()
            .projection(projection);

        const g = svg.append("g")
            .attr('class', 'center-container center-items us-state')
            .attr('height', height)
            .attr('width', width)

        g.append("g")
            .attr("id", "countries")
            .selectAll("path")
            .data(countyData.features)
            .enter()
            .append("path")
            .attr("d", pathGenerator as any)
            .attr("class", "country-boundary")
            .attr("fill", "#D0D0D0");

        // https://tgftp.nws.noaa.gov/data/raw/fs/fsxx21.egrr..txt
        g.append("g")
            .attr("id", "fronts")
            .selectAll("path")
            .data(frontsData.features)
            .enter()
            .filter(features => { 
                return features.properties.layer_name === "FRONT"
             })
            .append("path")
            .attr("d", pathGenerator as any)
            .attr("fill", "none")
            .attr("class", features => { 
                return parseFront(features.properties.layer_properties.front_type as string) || ""
            });

               
        renderFronts(g);

    }, []);

  return (
    <svg
      width={800}
      height={600}
      ref={ref}
    />
  )
}

export default App
