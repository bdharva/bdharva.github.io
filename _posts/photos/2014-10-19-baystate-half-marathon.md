---
layout: gallery
title: Baystate Half Marathon
category: photography
tags: Photography
thumbnail: /assets/photography/baystatehalf/baystatehalf-5.jpg
---

{% assign name = "baystatehalf" %}
{% for i in (1..5) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}