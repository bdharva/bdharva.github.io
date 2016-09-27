---
layout: gallery
title: Exploring Vail
category: photography
tags: Photography
thumbnail: /assets/photography/vail/vail-6.jpg
---

{% assign name = "vail" %}
{% for i in (1..6) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}