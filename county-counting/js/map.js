var Chart = ((document, window, d3) => {

	var map,
		county_details,
		snapshot = []

	var svg,
		legend_svg,
		slider_svg,
		proj,
		path,
		color,
		format,
		legend,
		counties,
		states,
		slider,
		slider_action,
		slider_label,
		progress,
		handle,
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
		end_month = 10

	var month_array = [];

	for (let i = start_year; i <= end_year; i++) {

		for (let j = 1; j <= 12; j++) {

			let entry = String(i) + '-' + String (j).padStart(2, '0');

			if (i > start_year & i < end_year) {

				month_array.push(entry);
			
			} else if (i == start_year) {

				 if (j >= start_month) {

				 	month_array.push(entry);

				 }
			
			} else if (i == end_year) {

				if (j <= end_month) {

					month_array.push(entry);

				} else {

					break;

				}

			}

		}
	}

	const slider_width = 260
	const slider_length = month_array.length - 1

	const slider_scale = d3.scaleLinear()
		.domain([0, slider_length])
		.rangeRound([slider_width / slider_length, slider_width * (slider_length - 1) / slider_length])
		.clamp(true)

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

		// snapshot = take_snapshot(snapshot, 'hours')
		snapshot = take_snapshot(snapshot, '2014-01')

		console.log(county_details)
		console.log(snapshot)

		svg = d3.select('#map')
			.append('svg')

		slider_svg = d3.select('#slider')
			.append('svg')

		legend_svg = d3.select('#legend')
			.append('svg')

		proj = d3.geoAlbersUsa()

		path = d3.geoPath()
			.projection(proj)

		color = d3.scaleThreshold()
			.domain([0.01, 1, 12, 24, 168, 720, 2190, 4380])
			.range(["#FFFFFF", "#E0F2F0", "#C3EBE1", "#A6E4D2", "#89DDC3", "#6CD6B4", "#4FCFA5", "#32C896"])

		format = d3.format('')

		legend = legend_svg.append("g")
			.attr("class", "legend")
			.call(legend)

		slider = slider_svg.append("g")
			.attr("class", "slider")
			.call(slider)

		slider_label = slider.append("text")
			.attr("class", "label")
			.attr("x", 0)
			.attr("y", -20)
			.attr("text-anchor", "left")
			.text('Test');

		slider_action = slider.append("text")
			.attr("class", "action")
			.attr("x", 200)
			.attr("y", -20)
			.attr("text-anchor", "right")
			.text('Animate')
			.on('click', handle_button_click)

		progress = slider.insert("line")
			.attr("class", "track-progress")
			.attr("x1", slider_scale.range()[0])
			.attr("x2", slider_scale(month_array.indexOf(String(end_year) + '-' + String(end_month).padStart(2, '0'))))

		handle = slider.insert("circle", ".track-overlay")
			.attr("class", "handle")
			.attr("r", 6);
		
		counties = svg.append("g")
			.selectAll("path")
			.data(topojson.feature(map, map.objects.counties).features)
			.join("path")
				.attr("fill", d => color(snapshot[d.id]))
				.attr("class", "county")
				.attr("stroke", "#191923")
				.attr("stroke-width", 0.1)
				.attr("d", path)

		states = svg.append("path")
			.datum(topojson.mesh(map, map.objects.states, (a, b) => a !== b))
			.attr("fill", "none")
			.attr("stroke", "#191923")
			.attr("stroke-width", 0.2)
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

		slider.transition() // Gratuitous intro!
			.duration(2000)
			.tween("slider_change", function() {
				var i = d3.interpolate(0, slider_scale(month_array.length - 1));
				return function(t) { slider_change(i(t)); };
			});

	}

	slider = g => {
		g.append("line")
			.attr("class", "track")
			.attr("x1", slider_scale.range()[0])
			.attr("x2", slider_scale.range()[1])
		g.append("line")
			.attr("class", "track-overlay")
			.attr("x1", slider_scale.range()[0])
			.attr("x2", slider_scale.range()[1])
			.call(d3.drag()
				.on("start.interrupt", function() { slider.interrupt(); })
				.on("end drag", function() { slider_change(d3.event.x); }));
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
			.attr("class", "legend_label")
			.attr("y", -6)
			.attr("fill", "currentColor")
			.attr("text-anchor", "start")
			.attr("font-weight", "bold")
			.text('Cumulative hours in county since 2014')

		g.call(d3.axisBottom(x)
			.tickSize(13)
			.tickFormat(i => color.domain()[i - 1])
			.tickValues(d3.range(1, length)))
			.select(".domain")
			.remove()

	}

	slider_change = h => {

		h = Math.ceil(slider_scale.invert(h))
		h = h < 0 ? 0 : h
		h = h > month_array - 1 ? month_array - 1 : h
		let label = month_array[h].split('-')
		display_year = label[0]
		display_month = label[1]
		update_display()
	}

	update_display = () => {

		let date = String(display_year) + '-' + String(display_month).padStart(2, '0')
		handle.attr("cx", slider_scale(month_array.indexOf(date)))
		progress.attr("x2", slider_scale(month_array.indexOf(date)))
		field = 'hours_' + date
		take_snapshot(snapshot, field)
		counties
			.transition(0)
			.attr("fill", d => color(snapshot[d.id]))
		slider_label
			.text(date)
	}

	handle_mouse_on = d => {

		counties.selectAll('county')
			.attr('stroke', '#000')
		
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

		let w = window.innerWidth
		let h = window.innerHeight

		if (d3.event.pageX > w / 2) {

			tooltip.html(tip)
				.style("left", null)
				.style("right", (w - d3.event.pageX) + "px")
				.style("top", (d3.event.pageY) + "px")

		} else {

			tooltip.html(tip)
				.style("left", (d3.event.pageX) + "px")
				.style("right", null)
				.style("top", (d3.event.pageY) + "px")

		}

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
			// button.classed('active', animation_active)

		} else {

			if (animation_paused) {

				animation_paused = !animation_paused
			
			} else {

				display_month = start_month
				display_year = start_year

			}
			
			animation_active = !animation_active
			interval_id = setInterval(animate_counties, 200)
			// button.classed('active', animation_active)

		}

	}

	animate_counties = () => {

		if (display_year < end_year | (display_year == end_year & display_month < end_month)) {

			update_display()

		} else {

			clearInterval(interval_id)
			animation_active = !animation_active
			// button
			// 	.html('Animate')
			// 	.classed('active', animation_active)

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

		slider_svg
			.attr('width', width)
			.attr('height', 64)

		proj
			.scale(width * 1.2)
			.translate([width / 2, height / 2])

		path
			.projection(proj)

		counties
			.attr('d', path)

		states
			.attr('d', path)

		// button
		// 	.html('Animate')
		// 	.classed('active', animation_active)

		legend
			.attr('transform', 'translate(' + (width / 2 - 130) + ',0)')

		slider
			.attr('transform', "translate(" + (width / 2 - 130) + ',40)')

	}

	update_dimensions = () => {

		width =  document.getElementById('map').clientWidth;
		width = width > 900 ? 900 : width
		height = width / 1.68;

	}

	return {

		render : render

	}

})(document, window, d3)

window.addEventListener('resize', Chart.render)