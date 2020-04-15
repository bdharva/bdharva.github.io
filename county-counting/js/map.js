var Chart = ((document, window, d3) => {

	var map,
		county_details,
		snapshot = []

	var svg,
		legend_svg,
		proj,
		path,
		color,
		format,
		legend,
		counties,
		states,
		width,
		height

	var interval_id,
		animation_active = false,
		animation_paused = false,
		display_year,
		display_month,
		start_year = 2014,
		start_month = 1,
		end_year = 2020,
		end_month = 4

	Promise.all([
		d3.json('data/counties-10m.json'),
		d3.csv('data/county_data.csv')
	]).then(
		data => init(data)
	)

	type = data => {

		let mapped_data = new Map()

		data.forEach(d => {

			let element = {}

			element['hours'] = +d.hours
			element['days'] = +d.days
			element['first_date'] = d.first_date
			element['last_date'] = d.last_date
			element['name'] = d.name
			element['state'] = d.state
			element['abbrev'] = d.abbrev

			for (year = 2014; year <= 2020; year++) {

				for (month = 1; month <= 12; month++) {

					let s_month = String(month).padStart(2, '0')
					let s_year = String(year)
					let field = 'hours_' + s_year + '-' + s_month
					
					element[field] = +(d[field] || 0)
				
				}
			
			}
    		
    		mapped_data.set(d.id, element)
    	
    	})

		return mapped_data

	}

	init = data => {

		map = data[0]
		
		county_details = Object.assign(
			type(data[1]),
			{title: "Hours spent in county"}
		)

		snapshot = take_snapshot(snapshot, 'hours')

		console.log(county_details)
		console.log(snapshot)

		svg = d3.select('#map')
			.append('svg')

		button = d3.select('#legend')
			.append('button')
			.on('click', handle_button_click)

		legend_svg = d3.select('#legend')
			.append('svg')

		proj = d3.geoAlbersUsa()

    	path = d3.geoPath()
    		.projection(proj)

    	color = d3.scaleThreshold()
    		.domain([0.01, 1, 12, 24, 168, 720, 2190, 4380])
    		.range(d3.schemeReds[9])

    	format = d3.format('')

		legend = legend_svg.append("g")
			.attr("class", "legend")
			.call(legend)
		
		counties = svg.append("g")
			.selectAll("path")
			.data(topojson.feature(map, map.objects.counties).features)
			.join("path")
				.attr("fill", d => color(snapshot[d.id]))
				.attr("class", "county")
				.attr("stroke", "white")
				.attr("stroke-width", 0.5)
				.attr("d", path)

		states = svg.append("path")
			.datum(topojson.mesh(map, map.objects.states, (a, b) => a !== b))
			.attr("fill", "none")
			.attr("stroke", "white")
			.attr("stroke-width", 1.5)
			.attr("stroke-linejoin", "round")
			.attr("d", path)

		tooltip = d3.select("body")
			.append("div")
			.attr("class", "tooltip")
			.style("opacity", 0)

		counties
			.on('click', handle_mouse_on)
			.on('mouseover', handle_mouse_on)
			.on('mouseout', handle_mouse_off)

		render()

	}

	legend = g => {
		const width = 260;
		const length = color.range().length

		const x = d3.scaleLinear()
			.domain([1, length - 1])
			.rangeRound([width / length, width * (length - 1) / length])

		g.selectAll("rect")
			.data(color.range())
			.join("rect")
				.attr("height", 6)
				.attr("x", (d, i) => x(i))
				.attr("width", (d, i) => x(i + 1) - x(i))
				.attr("fill", d => d)

		g.append("text")
			.attr("y", -6)
			.attr("fill", "currentColor")
			.attr("text-anchor", "start")
			.attr("font-weight", "bold")
			// .text(county_data.title)

		g.call(d3.axisBottom(x)
			.tickSize(13)
			.tickFormat(i => color.domain()[i - 1])
			.tickValues(d3.range(1, length)))
			.select(".domain")
			.remove()
	}

    handle_mouse_on = d => {

    	counties.selectAll('county')
    		.attr('stroke', 'black')
    	
    	tooltip.transition()
			.duration(500)
			.style("opacity", 1)

		var tip = "<strong>" +
			county_details.get(d.id).name + ', ' +
			county_details.get(d.id).abbrev + "</strong><br/>"

		if (county_details.get(d.id).hours > 0) {

			tip = tip +
				d3.format(",.2f")(county_details.get(d.id).hours) + ' hours over ' +
				county_details.get(d.id).days + " days<br/><br/>" +
				'First time: ' + county_details.get(d.id).first_date + "<br/>" +
				'Last time: ' + county_details.get(d.id).last_date

		} else {

			tip = tip + "Not Visited"

		}

		tooltip.html(tip)
			.style("left", (d3.event.pageX) + "px")
			.style("top", (d3.event.pageY) + "px")

    }

    handle_mouse_off = d => {

    	tooltip.transition()
			.duration(500)
			.style("opacity", 0)

    }

    handle_button_click = () => {

    	if (animation_active) {

    		clearInterval(interval_id)
    		animation_active = !animation_active
    		animation_paused = true
    		button.classed('active', animation_active)

    	} else {

    		if (animation_paused) {

    			animation_paused = !animation_paused
    		
    		} else {

    			display_month = start_month
	    		display_year = start_year

    		}
    		
    		animation_active = !animation_active
	    	interval_id = setInterval(animate_counties, 500)
	    	button.classed('active', animation_active)

    	}

    }

    animate_counties = () => {

    	if (display_year < end_year | (display_year == end_year & display_month < end_month)) {

			s_month = String(display_month).padStart(2, '0')
			s_year = String(display_year)
			field = 'hours_' + s_year + '-' + s_month
			take_snapshot(snapshot, field)
			counties
				.transition(500)
				.attr("fill", d => color(snapshot[d.id]))
			button
				.html(s_year + '-' + s_month)

		} else {

			clearInterval(interval_id)
			animation_active = !animation_active
			button
				.html('Animate')
				.classed('active', animation_active)

		}

		if (display_month < 12) {

			display_month += 1

		} else {

			display_year +=1
			display_month = 1

		}

    }

    take_snapshot = (data, field) => {

    	county_details.forEach((value, key) => {

    		data[key] = +(value[field] || 0)

    	})

    	return data

    }

	render = () => {

		update_dimensions()

		svg
			.attr('width', width)
			.attr('height', height)

		legend_svg
			.attr('width', width)
			.attr('height', 32)

		proj
			.scale(width * 1.2)
			.translate([width / 2, height / 2])

		path
			.projection(proj)

		counties
			.attr('d', path)

		states
			.attr('d', path)

		button
			.html('Animate')
			.classed('active', animation_active)

		legend
			.attr('transform', 'translate(' + (width / 2 - 130) + ',0)')

	}

	update_dimensions = () => {

		width =  document.getElementById('map').clientWidth;
		height = width / 1.68;

	}

	return {

		render : render

	}

})(document, window, d3)

window.addEventListener('resize', Chart.render)