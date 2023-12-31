import './App.scss';
import { useEffect, useRef } from "react";

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

    function drawCircle(start: SVGPoint, end: SVGPoint, context: d3.Path, size: number, flip: boolean) {
        const o = start.x - end.x,
            r = start.y - end.y,
            s = Math.atan2(-o, r),
            c = end.x + o / 2,
            l = end.y + r / 2,
            d = flip ? s + Math.PI / 2 : s - Math.PI / 2,
            p = flip ? s - Math.PI / 2 : s + Math.PI / 2;
        context.moveTo(c, l);
        context.arc(c, l, size, d, p);
    }

    function drawTriangle(start: SVGPoint, end: SVGPoint, context: d3.Path, size: number) {
        const a = start.x - end.x,
            o = start.y - end.y,
            r = Math.atan2(-a, o);

        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);

        const s = end.y + o / 2,
            c = end.x + a / 2 + Math.cos(r) * size,
            l = s + Math.sin(r) * size;

        context.lineTo(c, l);
        context.lineTo(start.x, start.y);
    }

    const renderFronts = function(g: d3.Selection<SVGGElement, unknown, null, undefined>) :void {
        const warm_context = d3.path();
        const warm_path = d3.path();
        const cold_context = d3.path();
        const cold_path = d3.path();
        const occluded_context = d3.path();

        Array.from(g.selectAll("path")).forEach((e: any) => {

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
                            drawCircle(start, end, warm_context, 6, false)
                            break;
    
                        case "cold-front":
                            drawTriangle(start, end, cold_context, 6)
                            break;

                        case "occluded-front":
                            if (last_shape == "circle") {
                                drawCircle(start, end, occluded_context, 6, false);
                                last_shape = "triangle";
                            } else {
                                drawTriangle(start, end, occluded_context, 6);
                                last_shape = "circle";
                            }
                            break;

                        case "stationary-front":
                            if (last_shape == "circle") {
                                warm_path.moveTo(end.x, end.y);
                                warm_path.lineTo(start.x, start.y);
                                drawCircle(start, end, warm_context, 6, true);
                                warm_path.closePath();
                                last_shape = "triangle";
                            } else {
                                cold_path.moveTo(end.x, end.y);
                                cold_path.lineTo(start.x, start.y);
                                drawTriangle(start, end, cold_context, 6);
                                cold_path.closePath();
                                last_shape = "circle";
                            }
                            break;
                    }                    
                }
            }
        });

        // There must be a better way to handle this, perhaps I should
        // draw directly all the lines using the canvas method. But making
        // dashed lines that change colour in D3.js is a bit of a nightmare.
        
        g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", warm_context as any)
            .attr("class", "warm-front shape");

        g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", cold_context as any)
            .attr("class", "cold-front shape");

        g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", occluded_context as any)
            .attr("class", "occluded-front shape");

        g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", warm_path as any)
            .attr("class", "warm-front");

        g.append("g")
            .attr("id", "fronts")
            .append("path")
            .attr("d", cold_path as any)
            .attr("class", "cold-front");
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
            .translate([480,1080])
      
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

        g.append("g")
            .attr("id", "pressure-points")
            .selectAll("text")
            .data(frontsData.features)
            .enter()
            .filter(features => { 
                return features.properties.layer_name === "PRESSURE_CENTER"
            })
            .append("text")
            .attr("class", features => { 
                const pc_type = (features.properties.layer_properties.pc_type || "").toLowerCase();
                return `pressure-centre ${pc_type}`
            })
            .attr("x", d => pathGenerator.centroid(d as any)[0])
            .attr("y", d => pathGenerator.centroid(d as any)[1])
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")            
            .text(features => {
                const pc_type = features.properties.layer_properties.pc_type;
                return (pc_type == "HIGH") ? "H" : "L";
            });

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
