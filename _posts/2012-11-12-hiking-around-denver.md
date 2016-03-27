---
layout: gallery
title: Hiking Around Denver
category: photography
tags: Photography
thumbnail: /assets/photography/denver/denver-1.jpg
---

{% assign name = "denver" %}
{% for i in (1..6) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}