---
layout: gallery
title: The Roman Baths
category: photography
tags: Photography
thumbnail: /assets/photography/bath/bath-6.jpg
---

{% assign name = "bath" %}
{% for i in (1..7) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}